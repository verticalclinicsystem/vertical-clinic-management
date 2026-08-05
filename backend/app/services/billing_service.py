"""
Billing service — handles business logic and validations for clinic invoices.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PatientNotFoundError, PermissionDeniedError
from app.models.invoice import Invoice
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.patient_repo import PatientRepository
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate

logger = logging.getLogger(__name__)


class BillingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.invoice_repo = InvoiceRepository(db)
        self.patient_repo = PatientRepository(db)

    async def create_invoice(self, request: InvoiceCreate) -> Invoice:
        """Create a new invoice for a patient."""
        # 1. Verify patient exists
        patient = await self.patient_repo.get_by_id(request.patient_id)
        if not patient:
            raise PatientNotFoundError()

        # 2. Generate unique invoice number
        invoice_number = await self.invoice_repo.get_next_invoice_number()

        # 3. Calculate totals
        grand_total = max(0.0, request.total_amount - request.discount_amount + request.tax_amount)
        
        invoice_data = {
            "patient_id": request.patient_id,
            "consultation_id": request.consultation_id,
            "treatment_plan_id": request.treatment_plan_id,
            "invoice_number": invoice_number,
            "total_amount": request.total_amount,
            "discount_amount": request.discount_amount,
            "tax_amount": request.tax_amount,
            "grand_total": grand_total,
            "amount_paid": 0.0,
            "balance_due": grand_total,
            "status": "unpaid",
        }

        created = await self.invoice_repo.create(invoice_data)
        await self.db.commit()
        logger.info(f"Invoice created successfully: {created.invoice_number}")

        # Send Invoice notification to patient
        try:
            from app.services.notification_service import NotificationService
            noti_service = NotificationService(self.db)
            await noti_service.send_multichannel_notification(
                user_id=patient.user_id,
                title="Invoice Generated",
                message=f"A new invoice ({invoice_number}) of {grand_total} has been generated for your clinic visit.",
                type="billing"
            )
        except Exception as e:
            logger.error(f"Failed to send invoice notification: {e}")

        return await self.get_invoice(created.id)

    async def get_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        """Fetch single invoice with details."""
        invoice = await self.invoice_repo.get_invoice_with_relations(invoice_id)
        if not invoice:
            from app.core.exceptions import BaseAPIException
            class InvoiceNotFoundError(BaseAPIException):
                def __init__(self):
                    super().__init__(
                        status_code=404,
                        error_code="INVOICE_NOT_FOUND",
                        message="Invoice not found."
                    )
            raise InvoiceNotFoundError()
        return invoice

    async def list_invoices(
        self,
        *,
        page: int = 1,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[Invoice], int]:
        """Fetch paginated & filtered list of invoices."""
        skip = (page - 1) * limit
        return await self.invoice_repo.get_invoices_paginated(
            skip=skip,
            limit=limit,
            patient_id=patient_id,
            status=status,
        )

    async def update_invoice(
        self,
        invoice_id: uuid.UUID,
        request: InvoiceUpdate,
    ) -> Invoice:
        """Update invoice details."""
        invoice = await self.get_invoice(invoice_id)

        update_data = request.model_dump(exclude_unset=True)
        
        # If amounts are updated, recalculate grand total and balance due
        total = update_data.get("total_amount", invoice.total_amount)
        discount = update_data.get("discount_amount", invoice.discount_amount)
        tax = update_data.get("tax_amount", invoice.tax_amount)
        
        grand_total = max(0.0, total - discount + tax)
        balance_due = max(0.0, grand_total - invoice.amount_paid)

        update_data["grand_total"] = grand_total
        update_data["balance_due"] = balance_due

        # If balance due is 0, make sure status is paid (unless cancelled)
        current_status = update_data.get("status", invoice.status)
        if current_status != "cancelled":
            if balance_due <= 0:
                update_data["status"] = "paid"
            elif invoice.amount_paid > 0:
                update_data["status"] = "partially_paid"
            else:
                update_data["status"] = "unpaid"

        updated = await self.invoice_repo.update(invoice, update_data)
        await self.db.commit()
        logger.info(f"Invoice updated: {updated.invoice_number}")
        return await self.get_invoice(updated.id)
