"""
Billing router — REST API endpoints for managing patient billing and invoices.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import get_current_user, get_db
from app.core.exceptions import PermissionDeniedError
from app.core.rbac import UserRole
from app.models.consultation import Consultation
from app.models.doctor import Doctor
from app.models.invoice import Invoice
from app.models.ipd import Admission, IpdBillItem
from app.models.patient import Patient
from app.models.prescription import Prescription, PrescriptionItem
from app.models.treatment import TreatmentPlan, TreatmentProcedure
from app.models.user import User
from app.schemas.invoice import InvoiceCreate, InvoiceOut, InvoicePrescriptionItem, InvoiceUpdate
from app.services.billing_service import BillingService, calculate_medicine_qty
from app.services.patient_service import PatientService
from app.utils.pdf_generator import generate_invoice_pdf
from app.utils.response import ApiResponse

router = APIRouter()


def invoice_to_out(invoice) -> dict:
    """Convert an Invoice ORM object to InvoiceOut dict, enriching with prescription items and full itemized breakdown."""
    data = InvoiceOut.model_validate(invoice).model_dump()
    
    # Enforce accurate payment status based on real balance_due & amount_paid
    if data.get("status") != "cancelled":
        bal = float(data.get("balance_due", 0.0))
        paid = float(data.get("amount_paid", 0.0))
        if bal <= 0:
            data["status"] = "paid"
        elif paid > 0:
            data["status"] = "partially_paid"
        else:
            data["status"] = "unpaid"

    # Attach prescription items & full breakdown (for bill receipt)
    items = []
    breakdown = []

    # 1. Consultation & Doctor fee
    if invoice.consultation:
        doc_name = ""
        if hasattr(invoice.consultation, "doctor") and invoice.consultation.doctor and hasattr(invoice.consultation.doctor, "user") and invoice.consultation.doctor.user:
            doc_name = f" - Dr. {invoice.consultation.doctor.user.full_name}"
        fee = getattr(getattr(invoice.consultation, "doctor", None), "consultation_fee", 500.0) or 500.0
        breakdown.append({
            "description": f"General Consultation{doc_name}",
            "amount": float(fee)
        })

        if hasattr(invoice.consultation, 'prescriptions') and invoice.consultation.prescriptions:
            for presc in invoice.consultation.prescriptions:
                if hasattr(presc, 'items'):
                    for item in presc.items:
                        items.append({
                            "medicine_name": item.medicine_name,
                            "dosage": item.dosage,
                            "frequency": getattr(item, "frequency", item.dosage),
                            "duration": item.duration,
                            "instructions": item.instructions or "",
                        })
                        qty = item.quantity if (hasattr(item, "quantity") and item.quantity is not None) else calculate_medicine_qty(item.dosage, item.duration)
                        unit_price = 10.0
                        if hasattr(item, "medicine") and item.medicine and hasattr(item.medicine, "unit_price") and item.medicine.unit_price:
                            unit_price = item.medicine.unit_price
                        total_med_cost = qty * unit_price
                        breakdown.append({
                            "description": f"Medicine: {item.medicine_name} ({qty} units)",
                            "amount": float(total_med_cost)
                        })

    # 2. Treatment Plan Procedures
    if invoice.treatment_plan and hasattr(invoice.treatment_plan, 'procedures'):
        for proc in invoice.treatment_plan.procedures:
            breakdown.append({
                "description": f"Procedure: {proc.procedure_name}",
                "amount": float(proc.cost)
            })

    # 3. IPD Bed Stay & Charges
    if invoice.admission:
        adm = invoice.admission
        end_t = adm.discharge_datetime or datetime.now(timezone.utc)
        hours_stay = max(0.5, (end_t - adm.admission_datetime).total_seconds() / 3600.0)
        bed = getattr(adm, "bed", None)
        if bed and hasattr(bed, "category") and bed.category:
            days = int(hours_stay // 24)
            rem_h = hours_stay % 24
            if days == 0:
                rent = bed.category.base_charge_24h
            else:
                overtime = rem_h * bed.category.hourly_overtime_rate if rem_h > 2.0 else 0.0
                rent = (days * bed.category.base_charge_24h) + overtime
            breakdown.append({
                "description": f"IPD Bed Stay: Bed {bed.bed_number} ({bed.category.name}) - {round(hours_stay, 1)}h stay",
                "amount": float(round(rent, 2))
            })

    data["prescription_items"] = items
    data["items_breakdown"] = breakdown
    return data


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create new invoice")
async def create_invoice(
    request: InvoiceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Create a new invoice for a patient visit or consultation."""
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only staff and doctors can create invoices.")

    service = BillingService(db)
    invoice = await service.create_invoice(request)
    return ApiResponse.success(
        data=invoice_to_out(invoice),
        message="Invoice generated successfully.",
        status_code=status.HTTP_201_CREATED,
    )


@router.get("/", summary="List invoices with pagination & filters")
async def list_invoices(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: UUID | None = Query(None),
    status: str | None = Query(None),
) -> JSONResponse:
    """Fetch paginated & filtered list of invoices."""
    service = BillingService(db)

    # Apply RBAC restrictions
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        patient_id = patient.id

    items, total = await service.list_invoices(
        page=page,
        limit=limit,
        patient_id=patient_id,
        status=status,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [invoice_to_out(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Invoices retrieved successfully.",
    )


@router.get("/calculate-pending", summary="Calculate pending charges for a patient")
async def calculate_pending_charges(
    patient_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    exclude_invoice_id: UUID | None = Query(None),
) -> JSONResponse:
    """
    Calculate all pending/completed unbilled charges for a patient.
    Aggregates completed consultations, procedures, medicine items, and IPD bed stays.
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only staff/doctors can access pending billing details.")

    unbilled_consultations = []
    unbilled_plans = []
    unbilled_admissions = []
    recommended_materials = [
        {"name": "Disposable Syringe & Local Anesthesia", "cost": 250.0},
        {"name": "Cotton Rolls, Saliva Ejector & Sterile Drape", "cost": 100.0}
    ]

    try:
        # Fetch consultations with doctor, prescriptions, items, medicines
        stmt = (
            select(Consultation)
            .options(
                joinedload(Consultation.doctor).joinedload(Doctor.user),
                joinedload(Consultation.prescriptions).joinedload(Prescription.items).joinedload(PrescriptionItem.medicine)
            )
            .where(Consultation.patient_id == patient_id)
            .order_by(Consultation.created_at.desc())
        )
        result = await db.execute(stmt)
        consultations = result.unique().scalars().all()

        # Find which consultation IDs are already invoiced
        invoice_stmt = select(Invoice.consultation_id).where(Invoice.patient_id == patient_id, Invoice.consultation_id.isnot(None))
        if exclude_invoice_id:
            invoice_stmt = invoice_stmt.where(Invoice.id != exclude_invoice_id)
        invoice_result = await db.execute(invoice_stmt)
        invoiced_consultation_ids = set(invoice_result.scalars().all())

        for c in consultations:
            if c.id in invoiced_consultation_ids:
                continue
                
            fee = float(getattr(c.doctor, "consultation_fee", 500.0) or 500.0) if getattr(c, "doctor", None) else 500.0
            
            prescriptions_list = []
            if hasattr(c, "prescriptions") and c.prescriptions:
                for p in c.prescriptions:
                    items_list = []
                    if hasattr(p, "items") and p.items:
                        for item in p.items:
                            qty = item.quantity if (hasattr(item, "quantity") and item.quantity is not None) else calculate_medicine_qty(getattr(item, "dosage", ""), getattr(item, "duration", ""))
                            med = getattr(item, "medicine", None)
                            unit_price = float(getattr(med, "unit_price", 10.0) or 10.0) if med else 10.0
                            items_list.append({
                                "medicine_name": getattr(item, "medicine_name", "Medicine"),
                                "dosage": getattr(item, "dosage", ""),
                                "frequency": getattr(item, "frequency", getattr(item, "dosage", "")),
                                "duration": getattr(item, "duration", ""),
                                "quantity": qty,
                                "unit_price": unit_price,
                                "total": qty * unit_price
                            })
                    prescriptions_list.append({
                        "id": str(p.id),
                        "diagnosis": getattr(c, "diagnosis", "") or getattr(p, "notes", "") or "",
                        "notes": getattr(p, "notes", "") or "",
                        "items": items_list
                    })

            doc_name = "Doctor"
            if getattr(c, "doctor", None) and getattr(c.doctor, "user", None):
                doc_name = f"Dr. {c.doctor.user.full_name}"

            c_date = c.created_at.strftime("%Y-%m-%d") if getattr(c, "created_at", None) else datetime.now(timezone.utc).strftime("%Y-%m-%d")

            unbilled_consultations.append({
                "id": str(c.id),
                "date": c_date,
                "doctor_name": doc_name,
                "consultation_fee": fee,
                "prescriptions": prescriptions_list
            })
    except Exception as err:
        print(f"Error compiling consultations for pending charges: {err}")

    try:
        # Fetch treatment plans
        tp_stmt = (
            select(TreatmentPlan)
            .options(joinedload(TreatmentPlan.procedures))
            .where(TreatmentPlan.patient_id == patient_id)
            .order_by(TreatmentPlan.created_at.desc())
        )
        tp_result = await db.execute(tp_stmt)
        treatment_plans = tp_result.unique().scalars().all()

        invoiced_tp_stmt = select(Invoice.treatment_plan_id).where(Invoice.patient_id == patient_id, Invoice.treatment_plan_id.isnot(None))
        if exclude_invoice_id:
            invoiced_tp_stmt = invoiced_tp_stmt.where(Invoice.id != exclude_invoice_id)
        invoiced_tp_result = await db.execute(invoiced_tp_stmt)
        invoiced_tp_ids = set(invoiced_tp_result.scalars().all())

        for plan in treatment_plans:
            if plan.id in invoiced_tp_ids:
                continue
            
            procedures_list = []
            if hasattr(plan, "procedures") and plan.procedures:
                for proc in plan.procedures:
                    if getattr(proc, "status", None) == "completed":
                        procedures_list.append({
                            "id": str(proc.id),
                            "name": getattr(proc, "procedure_name", "Procedure"),
                            "cost": float(getattr(proc, "cost", 0.0) or 0.0),
                            "status": getattr(proc, "status", "completed")
                        })
            
            if procedures_list:
                unbilled_plans.append({
                    "id": str(plan.id),
                    "title": getattr(plan, "title", "Treatment Plan"),
                    "procedures": procedures_list
                })
    except Exception as err:
        print(f"Error compiling treatment plans for pending charges: {err}")

    try:
        # Fetch active or unbilled IPD admissions for this specific patient
        adm_stmt = (
            select(Admission)
            .where(Admission.patient_id == patient_id)
            .order_by(Admission.admission_datetime.desc())
        )
        adm_result = await db.execute(adm_stmt)
        admissions = adm_result.scalars().all()

        invoiced_adm_stmt = select(Invoice.admission_id, Invoice.admission_ids_json).where(Invoice.patient_id == patient_id)
        if exclude_invoice_id:
            invoiced_adm_stmt = invoiced_adm_stmt.where(Invoice.id != exclude_invoice_id)
        invoiced_adm_res = await db.execute(invoiced_adm_stmt)
        invoiced_adm_ids = set()
        for single_id, json_str in invoiced_adm_res.all():
            if single_id:
                invoiced_adm_ids.add(single_id)
            if json_str:
                try:
                    for item_id in json.loads(json_str):
                        invoiced_adm_ids.add(UUID(item_id))
                except Exception:
                    pass

        for adm in admissions:
            if adm.id in invoiced_adm_ids:
                continue
            
            adm_dt = getattr(adm, "admission_datetime", None) or datetime.now(timezone.utc)
            if adm_dt.tzinfo is None:
                adm_dt = adm_dt.replace(tzinfo=timezone.utc)
            dis_dt = getattr(adm, "discharge_datetime", None)
            if dis_dt is not None and dis_dt.tzinfo is None:
                dis_dt = dis_dt.replace(tzinfo=timezone.utc)
            end_time = dis_dt or datetime.now(timezone.utc)
            hours_stay = max(0.5, (end_time - adm_dt).total_seconds() / 3600.0)
            
            bed = getattr(adm, "bed", None)
            bed_num = getattr(bed, "bed_number", "N/A") if bed else "N/A"
            category = getattr(bed, "category", None) if bed else None
            category_name = getattr(category, "name", "General Ward") if category else "General Ward"
            base_charge_24h = float(getattr(category, "base_charge_24h", 1200.0) or 1200.0) if category else 1200.0
            hourly_rate = float(getattr(category, "hourly_overtime_rate", 50.0) or 50.0) if category else 50.0

            days = int(hours_stay // 24)
            rem_hours = hours_stay % 24

            if days == 0:
                total_rent = base_charge_24h
            else:
                overtime_charge = rem_hours * hourly_rate if rem_hours > 2.0 else 0.0
                total_rent = (days * base_charge_24h) + overtime_charge

            total_rent = round(total_rent, 2)

            # Fetch past transferred bed bill items
            past_items_list = []
            try:
                past_stmt = select(IpdBillItem).where(IpdBillItem.admission_id == adm.id)
                past_res = await db.execute(past_stmt)
                past_items = past_res.scalars().all()
                past_items_list = [
                    {
                        "id": str(pi.id),
                        "item_name": getattr(pi, "item_name", "Item"),
                        "quantity": getattr(pi, "quantity", 1),
                        "unit_price": float(getattr(pi, "unit_price", 0.0) or 0.0),
                        "total_price": float(getattr(pi, "total_price", 0.0) or 0.0)
                    }
                    for pi in past_items
                ]
            except Exception:
                past_items_list = []

            unbilled_admissions.append({
                "id": str(adm.id),
                "admission_number": getattr(adm, "admission_number", f"ADM-{str(adm.id)[:8].upper()}"),
                "bed_number": bed_num,
                "category_name": category_name,
                "admission_datetime": adm_dt.isoformat(),
                "discharge_datetime": dis_dt.isoformat() if dis_dt else None,
                "hours_stay": round(hours_stay, 1),
                "hours_stayed": round(hours_stay, 1),
                "estimated_rent": total_rent,
                "current_bed_rent": total_rent,
                "initial_deposit": float(getattr(adm, "initial_deposit", 0.0) or 0.0),
                "insurance_approved_amount": float(getattr(adm, "insurance_approved_amount", 0.0) or 0.0),
                "past_items": past_items_list,
                "status": getattr(adm, "admission_status", "admitted")
            })
    except Exception as err:
        print(f"Error compiling IPD admissions for pending charges: {err}")

    return ApiResponse.success(
        data={
            "consultations": unbilled_consultations,
            "treatment_plans": unbilled_plans,
            "admissions": unbilled_admissions,
            "ipd_admissions": unbilled_admissions,
            "recommended_materials": recommended_materials
        },
        message="Unbilled charges calculated successfully."
    )


@router.get("/{invoice_id}", summary="Get single invoice details")
async def get_invoice(
    invoice_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch details of a specific invoice."""
    service = BillingService(db)
    invoice = await service.get_invoice(invoice_id)

    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if invoice.patient_id != patient.id:
            raise PermissionDeniedError("Access denied to another patient's invoice.")

    return ApiResponse.success(
        data=invoice_to_out(invoice),
        message="Invoice fetched successfully.",
    )


@router.put("/{invoice_id}", summary="Update invoice details")
async def update_invoice(
    invoice_id: UUID,
    request: InvoiceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Update an existing invoice's payment status, discount, or amounts."""
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only authorized staff can update invoices.")

    service = BillingService(db)
    updated = await service.update_invoice(invoice_id, request)
    return ApiResponse.success(
        data=invoice_to_out(updated),
        message="Invoice updated successfully.",
    )


@router.get("/{invoice_id}/download-pdf", summary="Download invoice PDF file")
async def download_invoice_pdf(
    invoice_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Generate and return binary PDF stream for an invoice."""
    service = BillingService(db)
    invoice = await service.get_invoice(invoice_id)

    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if invoice.patient_id != patient.id:
            raise PermissionDeniedError("Access denied to another patient's invoice PDF.")

    status_mapping = {
        "paid": "paid",
        "unpaid": "unpaid",
        "partially_paid": "partial"
    }
    status_class = status_mapping.get(invoice.status, "unpaid")

    pdf_items = []
    if getattr(invoice, "consultation", None):
        c = invoice.consultation
        doc = getattr(c, "doctor", None)
        fee = float(getattr(doc, "consultation_fee", 500.0) or 500.0) if doc else 500.0
        doc_user = getattr(doc, "user", None) if doc else None
        doc_name = doc_user.full_name if doc_user else "Doctor"
        pdf_items.append({
            "description": f"Consultation Fee - Dr. {doc_name}",
            "amount": float(fee)
        })
        if hasattr(c, "prescriptions") and c.prescriptions:
            for presc in c.prescriptions:
                if hasattr(presc, "items") and presc.items:
                    for item in presc.items:
                        qty = item.quantity if (hasattr(item, "quantity") and item.quantity is not None) else calculate_medicine_qty(getattr(item, "dosage", ""), getattr(item, "duration", ""))
                        med = getattr(item, "medicine", None)
                        price = float(getattr(med, "unit_price", 10.0) or 10.0) if med else 10.0
                        pdf_items.append({
                            "description": f"Medicine: {getattr(item, 'medicine_name', 'Medicine')} ({qty} units)",
                            "amount": float(qty * price)
                        })

    if getattr(invoice, "treatment_plan", None) and hasattr(invoice.treatment_plan, "procedures"):
        for proc in invoice.treatment_plan.procedures:
            if getattr(proc, "status", None) == "completed":
                pdf_items.append({
                    "description": f"Procedure: {getattr(proc, 'procedure_name', 'Procedure')}",
                    "amount": float(getattr(proc, "cost", 0.0) or 0.0)
                })

    if getattr(invoice, "admission", None):
        adm = invoice.admission
        adm_dt = getattr(adm, "admission_datetime", None) or datetime.now(timezone.utc)
        dis_dt = getattr(adm, "discharge_datetime", None)
        end_t = dis_dt or datetime.now(timezone.utc)
        hours_stay = max(0.5, (end_t - adm_dt).total_seconds() / 3600.0)
        bed = getattr(adm, "bed", None)
        if bed and getattr(bed, "category", None):
            days = int(hours_stay // 24)
            rem_h = hours_stay % 24
            base_c = float(getattr(bed.category, "base_charge_24h", 1200.0) or 1200.0)
            over_c = float(getattr(bed.category, "hourly_overtime_rate", 50.0) or 50.0)
            rent = base_c if days == 0 else (days * base_c) + (rem_h * over_c if rem_h > 2.0 else 0.0)
            pdf_items.append({
                "description": f"IPD Bed Stay: {getattr(bed, 'bed_number', 'N/A')} ({getattr(bed.category, 'name', 'General')}) - {round(hours_stay, 1)} hours",
                "amount": float(round(rent, 2))
            })

    invoice_data = {
        "invoice_number": invoice.invoice_number,
        "date": invoice.created_at.strftime("%Y-%m-%d"),
        "status": invoice.status.replace("_", " ").title(),
        "status_class": status_class,
        "patient_name": invoice.patient.user.full_name,
        "patient_code": invoice.patient.patient_code,
        "patient_phone": invoice.patient.emergency_contact_phone or "N/A",
        "branch_name": "Vertical Clinic System - Main",
        "branch_address": "123, Medical Square, Ahmedabad, Gujarat",
        "branch_phone": "+91 99999 88888",
        "items": pdf_items,
        "total_amount": float(invoice.total_amount),
        "discount_amount": float(invoice.discount_amount),
        "tax_amount": float(invoice.tax_amount),
        "grand_total": float(invoice.grand_total),
        "amount_paid": float(invoice.amount_paid),
        "balance_due": float(invoice.balance_due),
    }

    pdf_bytes = generate_invoice_pdf(invoice_data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice_{invoice.invoice_number}.pdf"
        }
    )


@router.post("/{invoice_id}/send-email")
async def send_invoice_email(
    invoice_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Generate invoice PDF and email it to the patient."""
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only staff can send invoice emails.")

    service = BillingService(db)
    success = await service.send_invoice_email_to_patient(invoice_id)
    if success:
        return ApiResponse.success(data=None, message="Invoice emailed to patient successfully.")
    else:
        return ApiResponse.error(message="Failed to email invoice. Check patient email settings.", status_code=status.HTTP_400_BAD_REQUEST)
