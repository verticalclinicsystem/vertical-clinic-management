"""
Prescription service — business logic for prescribing medicines and stock integration.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.exceptions import DoctorNotFoundError, PatientNotFoundError
from app.models.prescription import Prescription, PrescriptionItem
from app.models.inventory import Medicine, StockTransaction
from app.repositories.prescription_repo import PrescriptionRepository
from app.repositories.doctor_repo import DoctorRepository
from app.repositories.patient_repo import PatientRepository
from app.schemas.prescription import PrescriptionCreate, PrescriptionUpdate

logger = logging.getLogger(__name__)


class PrescriptionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.prescription_repo = PrescriptionRepository(db)
        self.doctor_repo = DoctorRepository(db)
        self.patient_repo = PatientRepository(db)

    async def create_prescription(self, request: PrescriptionCreate) -> Prescription:
        """Create a new prescription with medications."""
        # 1. Verify doctor and patient exist
        patient = await self.patient_repo.get_by_id(request.patient_id)
        if not patient:
            raise PatientNotFoundError()

        doctor = await self.doctor_repo.get_by_id(request.doctor_id)
        if not doctor:
            raise DoctorNotFoundError()

        # 2. Create prescription record (defaults to Pending)
        presc_data = {
            "consultation_id": request.consultation_id,
            "patient_id": request.patient_id,
            "doctor_id": request.doctor_id,
            "notes": request.notes,
            "status": "Pending",
        }
        created = await self.prescription_repo.create(presc_data)

        # 3. Create items
        for item in request.items:
            # Save item
            presc_item = PrescriptionItem(
                prescription_id=created.id,
                medicine_id=item.medicine_id,
                medicine_name=item.medicine_name,
                dosage=item.dosage,
                duration=item.duration,
                instructions=item.instructions,
                quantity=item.quantity,
            )
            await self.prescription_repo.save_item(presc_item)

        await self.db.commit()
        presc_id = created.id
        logger.info(f"Prescription created successfully: {presc_id}")

        # Send Prescription Created notification to patient
        try:
            from app.services.notification_service import NotificationService
            noti_service = NotificationService(self.db)
            await noti_service.send_multichannel_notification(
                user_id=patient.user_id,
                title="New Prescription Added",
                message=f"Dr. {doctor.user.full_name} has prescribed new medications for you. Please check your portal.",
                type="prescription"
            )
        except Exception as e:
            logger.error(f"Failed to send prescription notification: {e}")

        return await self.get_prescription(presc_id)

    async def dispense_prescription(self, prescription_id: uuid.UUID, performed_by_id: uuid.UUID | None = None) -> Prescription:
        """Dispense medicines from a prescription, reducing stock levels and logging transactions."""
        prescription = await self.get_prescription(prescription_id)
        if prescription.status == "Dispensed":
            from app.core.exceptions import ValidationError
            raise ValidationError("Prescription is already dispensed.")

        prescription.status = "Dispensed"

        # Track medicines resolved and their prices for invoice generation
        medicine_line_items: list[dict] = []

        for item in prescription.items:
            medicine = None
            if item.medicine_id:
                medicine = await self.db.get(Medicine, item.medicine_id)
            elif item.medicine_name:
                from sqlalchemy import func
                stmt = select(Medicine).where(func.lower(Medicine.name) == func.lower(item.medicine_name))
                res = await self.db.execute(stmt)
                medicine = res.scalars().first()
                if medicine:
                    item.medicine_id = medicine.id

            if medicine:
                # Use specified quantity on prescription item, fallback to 10
                qty_to_dispense = item.quantity if item.quantity is not None else 10
                # If we have stock, reduce it; handle negative limits
                medicine.stock_qty = max(0, medicine.stock_qty - qty_to_dispense)
                
                # Log stock transaction audit trail
                txn = StockTransaction(
                    medicine_id=medicine.id,
                    change_qty=-qty_to_dispense,
                    transaction_type="dispense",
                    reference_id=prescription.id,
                    notes=f"Dispensed via prescription: {prescription.id}",
                    performed_by_id=performed_by_id,
                )
                self.db.add(txn)

                # Track for invoice
                unit_price = float(medicine.unit_price or 0.0)
                line_total = round(unit_price * qty_to_dispense, 2)
                medicine_line_items.append({
                    "medicine_name": item.medicine_name,
                    "qty": qty_to_dispense,
                    "unit": medicine.unit,
                    "unit_price": unit_price,
                    "line_total": line_total,
                    "dosage": item.dosage,
                    "duration": item.duration,
                })
            else:
                # Medicine not found in inventory — still record for bill notes (₹0)
                medicine_line_items.append({
                    "medicine_name": item.medicine_name,
                    "qty": 1,
                    "unit": "unit",
                    "unit_price": 0.0,
                    "line_total": 0.0,
                    "dosage": item.dosage,
                    "duration": item.duration,
                })

        # ── Auto-generate Invoice for this dispensed prescription ─────────────
        # Only create if not already linked to an existing invoice for this consultation
        try:
            from app.repositories.invoice_repo import InvoiceRepository
            from app.models.invoice import Invoice
            from sqlalchemy import select as sa_select

            # Check if an invoice already exists for this consultation
            existing_inv = None
            if prescription.consultation_id:
                stmt = sa_select(Invoice).where(Invoice.consultation_id == prescription.consultation_id)
                res = await self.db.execute(stmt)
                existing_inv = res.scalars().first()

            subtotal = round(sum(li["line_total"] for li in medicine_line_items), 2)
            gst_rate = 0.18
            tax_amount = round(subtotal * gst_rate, 2)
            grand_total = round(subtotal + tax_amount, 2)

            invoice_repo = InvoiceRepository(self.db)

            if existing_inv:
                # Update the existing invoice amounts (add medicine cost on top)
                existing_subtotal = float(existing_inv.total_amount)
                new_subtotal = round(existing_subtotal + subtotal, 2)
                new_tax = round(new_subtotal * gst_rate, 2)
                new_grand = round(new_subtotal + new_tax, 2)
                await invoice_repo.update(existing_inv, {
                    "total_amount": new_subtotal,
                    "tax_amount": new_tax,
                    "grand_total": new_grand,
                    "balance_due": max(0.0, new_grand - float(existing_inv.amount_paid)),
                })
                logger.info(f"Invoice {existing_inv.invoice_number} updated with medicine costs.")
            else:
                # Create a fresh invoice for these medicines
                invoice_number = await invoice_repo.get_next_invoice_number()
                new_invoice = Invoice(
                    patient_id=prescription.patient_id,
                    consultation_id=prescription.consultation_id,
                    invoice_number=invoice_number,
                    total_amount=subtotal,
                    discount_amount=0.0,
                    tax_amount=tax_amount,
                    grand_total=grand_total,
                    amount_paid=0.0,
                    balance_due=grand_total,
                    status="unpaid",
                )
                self.db.add(new_invoice)
                logger.info(f"Auto-invoice {invoice_number} created for prescription {prescription_id}.")
        except Exception as inv_err:
            # Non-blocking — log but don't prevent dispensing
            logger.warning(f"Could not auto-create invoice for prescription {prescription_id}: {inv_err}")

        await self.db.commit()
        logger.info(f"Prescription {prescription_id} dispensed successfully.")
        return await self.get_prescription(prescription_id)

    async def get_prescription(self, prescription_id: uuid.UUID) -> Prescription:
        """Fetch details of a single prescription."""
        prescription = await self.prescription_repo.get_prescription_with_relations(prescription_id)
        if not prescription:
            from app.core.exceptions import BaseAPIException
            class PrescriptionNotFoundError(BaseAPIException):
                def __init__(self):
                    super().__init__(
                        status_code=404,
                        error_code="PRESCRIPTION_NOT_FOUND",
                        message="Prescription not found."
                    )
            raise PrescriptionNotFoundError()
        return prescription

    async def list_prescriptions(
        self,
        *,
        page: int = 1,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        doctor_id: uuid.UUID | None = None,
        consultation_id: uuid.UUID | None = None,
    ) -> tuple[list[Prescription], int]:
        """Fetch paginated, filtered prescriptions list."""
        skip = (page - 1) * limit
        return await self.prescription_repo.get_prescriptions_paginated(
            skip=skip,
            limit=limit,
            patient_id=patient_id,
            doctor_id=doctor_id,
            consultation_id=consultation_id,
        )

    async def update_prescription(self, prescription_id: uuid.UUID, request: PrescriptionUpdate) -> Prescription:
        """Update prescription notes, status, and items (supporting additions/removals)."""
        prescription = await self.get_prescription(prescription_id)
        
        if request.notes is not None:
            prescription.notes = request.notes
            
        if request.status is not None:
            prescription.status = request.status

        if request.items is not None:
            # Clear existing items - delete-orphan handles cleanup
            prescription.items.clear()
            
            # Add new/modified items
            for item in request.items:
                presc_item = PrescriptionItem(
                    prescription_id=prescription.id,
                    medicine_id=item.medicine_id,
                    medicine_name=item.medicine_name,
                    dosage=item.dosage,
                    duration=item.duration,
                    instructions=item.instructions,
                    quantity=item.quantity,
                )
                prescription.items.append(presc_item)

        await self.db.commit()
        logger.info(f"Prescription updated successfully: {prescription.id}")
        return await self.get_prescription(prescription.id)
