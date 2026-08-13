"""
Billing router — REST API endpoints for managing patient billing and invoices.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole
from app.core.exceptions import PermissionDeniedError
from app.models.user import User
from app.schemas.invoice import InvoiceOut, InvoiceCreate, InvoiceUpdate, InvoicePrescriptionItem
from app.services.billing_service import BillingService
from app.services.patient_service import PatientService
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
                            "duration": item.duration,
                            "instructions": item.instructions,
                        })
                        qty = getattr(item, "quantity", None)
                        if qty is None:
                            qty = calculate_medicine_qty(item.dosage, item.duration)
                        med_price = getattr(getattr(item, "medicine", None), "unit_price", 10.0) or 10.0
                        breakdown.append({
                            "description": f"Medicine: {item.medicine_name} ({qty} units)",
                            "amount": round(qty * med_price, 2)
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
        from datetime import datetime, timezone
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

        if getattr(adm, "initial_deposit", 0) > 0:
            breakdown.append({
                "description": f"Less: Initial Admission Deposit Paid (Bed {bed.bed_number if bed else ''})",
                "amount": float(-adm.initial_deposit)
            })
        if getattr(adm, "insurance_approved_amount", 0) > 0:
            breakdown.append({
                "description": "Less: Insurance Approved Credit",
                "amount": float(-adm.insurance_approved_amount)
            })

    # Check if there is a remaining clinical materials or extra consumables cost in total_amount
    pos_sum = sum(float(item["amount"]) for item in breakdown if float(item["amount"]) > 0)
    diff = round(float(data.get("total_amount", 0.0)) - pos_sum, 2)
    if diff > 0.01:
        breakdown.append({
            "description": "Clinical Materials & Sterile Consumables",
            "amount": diff
        })

    # Fallback if breakdown is empty but total_amount > 0
    if not breakdown and float(data.get("total_amount", 0.0)) > 0:
        breakdown.append({
            "description": "General Clinical Services & Consultation",
            "amount": float(data.get("total_amount", 0.0))
        })

    data["prescription_items"] = items
    data["items_breakdown"] = breakdown
    return data



# ── 1. POST /billing ───────────────────────────────────────────────────────────
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new invoice",
)
async def create_invoice(
    request: InvoiceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Create a new patient invoice.
    - Restricted to Doctors, Receptionists, Pharmacists, or Admins.
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only doctors or staff can create invoices.")

    service = BillingService(db)
    invoice = await service.create_invoice(request)
    return ApiResponse.success(
        data=invoice_to_out(invoice),
        message="Invoice created successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── 2. GET /billing ────────────────────────────────────────────────────────────
@router.get(
    "/",
    summary="List/search invoices",
)
async def list_invoices(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: UUID | None = Query(None),
    status: str | None = Query(None),
) -> JSONResponse:
    """
    List patient invoices.
    - Patients are restricted to viewing only their own invoices.
    - Staff/Admin can view all invoices.
    """
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


def calculate_medicine_qty(dosage: str, duration: str) -> int:
    import re
    # Default to 10 if we can't parse
    days = 5
    m_dur = re.search(r'(\d+)\s*(day|week|month)', duration.lower())
    if m_dur:
        val = int(m_dur.group(1))
        unit = m_dur.group(2)
        if 'week' in unit:
            days = val * 7
        elif 'month' in unit:
            days = val * 30
        else:
            days = val
    else:
        m_num = re.search(r'^(\d+)$', duration.strip())
        if m_num:
            days = int(m_num.group(1))
            
    daily = 2
    if '-' in dosage:
        parts = dosage.split('-')
        try:
            daily = sum(int(p) for p in parts if p.strip().isdigit())
        except:
            daily = 2
    else:
        m_dos = re.search(r'(\d+)', dosage)
        if m_dos:
            daily = int(m_dos.group(1))
            
    return max(1, days * daily)


@router.get("/calculate-pending", summary="Calculate pending charges for a patient")
async def calculate_pending_charges(
    patient_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    exclude_invoice_id: UUID | None = Query(None),
) -> JSONResponse:
    """
    Calculate all pending/completed unbilled charges for a patient.
    Aggregates:
    - Consultation fees
    - Treatment plan procedure charges
    - Prescribed and dispensed medicine costs
    - Clinical materials used
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only staff/doctors can access pending billing details.")

    from sqlalchemy import select
    from app.models.consultation import Consultation
    from app.models.patient import Patient
    from app.models.doctor import Doctor
    from app.models.prescription import Prescription, PrescriptionItem
    from app.models.treatment import TreatmentPlan, TreatmentProcedure
    from app.models.invoice import Invoice
    from sqlalchemy.orm import joinedload
    
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

    unbilled_consultations = []
    for c in consultations:
        if c.id in invoiced_consultation_ids:
            continue
            
        fee = c.doctor.consultation_fee or 500.0
        
        prescriptions_list = []
        for p in c.prescriptions:
            items_list = []
            for item in p.items:
                qty = item.quantity if (hasattr(item, "quantity") and item.quantity is not None) else calculate_medicine_qty(item.dosage, item.duration)
                unit_price = item.medicine.unit_price if item.medicine else 10.0
                items_list.append({
                    "medicine_name": item.medicine_name,
                    "dosage": item.dosage,
                    "duration": item.duration,
                    "qty": qty,
                    "unit_price": float(unit_price),
                    "total_price": float(qty * unit_price)
                })
            prescriptions_list.append({
                "id": str(p.id),
                "status": p.status,
                "items": items_list
            })
            
        unbilled_consultations.append({
            "id": str(c.id),
            "doctor_name": c.doctor.user.full_name,
            "consultation_datetime": c.consultation_datetime.isoformat(),
            "diagnosis": c.diagnosis,
            "consultation_fee": float(fee),
            "prescriptions": prescriptions_list
        })

    # Fetch treatment plans & completed procedures
    plan_stmt = (
        select(TreatmentPlan)
        .options(
            joinedload(TreatmentPlan.procedures)
        )
        .where(TreatmentPlan.patient_id == patient_id)
    )
    plan_result = await db.execute(plan_stmt)
    plans = plan_result.unique().scalars().all()

    invoiced_plan_stmt = select(Invoice.treatment_plan_id).where(Invoice.patient_id == patient_id, Invoice.treatment_plan_id.isnot(None))
    if exclude_invoice_id:
        invoiced_plan_stmt = invoiced_plan_stmt.where(Invoice.id != exclude_invoice_id)
    invoiced_plan_res = await db.execute(invoiced_plan_stmt)
    invoiced_plan_ids = set(invoiced_plan_res.scalars().all())

    unbilled_plans = []
    for plan in plans:
        unbilled_procedures = []
        for proc in plan.procedures:
            if plan.id not in invoiced_plan_ids and proc.status == "completed":
                unbilled_procedures.append({
                    "id": str(proc.id),
                    "procedure_name": proc.procedure_name,
                    "cost": float(proc.cost),
                    "status": proc.status
                })
        
        if unbilled_procedures:
            unbilled_plans.append({
                "id": str(plan.id),
                "title": plan.title,
                "status": plan.status,
                "procedures": unbilled_procedures
            })

    materials = [
        {"name": "Clinical Gloves, Mask & Sanitizer Kit", "cost": 150.0},
        {"name": "Disposable Syringe & Local Anesthesia", "cost": 250.0},
        {"name": "Cotton Rolls, Saliva Ejector & Sterile Drape", "cost": 100.0}
    ]

    # Fetch active or unbilled IPD admissions for this specific patient
    from app.models.ipd import Admission, IpdBillItem
    adm_stmt = (
        select(Admission)
        .where(
            Admission.patient_id == patient_id
        )
        .order_by(Admission.admission_datetime.desc())
    )
    adm_result = await db.execute(adm_stmt)
    admissions = adm_result.scalars().all()

    invoiced_adm_stmt = select(Invoice.admission_id, Invoice.admission_ids_json).where(Invoice.patient_id == patient_id)
    if exclude_invoice_id:
        invoiced_adm_stmt = invoiced_adm_stmt.where(Invoice.id != exclude_invoice_id)
    invoiced_adm_res = await db.execute(invoiced_adm_stmt)
    invoiced_adm_ids = set()
    import json
    for single_id, json_str in invoiced_adm_res.all():
        if single_id:
            invoiced_adm_ids.add(single_id)
        if json_str:
            try:
                for item_id in json.loads(json_str):
                    invoiced_adm_ids.add(UUID(item_id))
            except Exception:
                pass

    unbilled_admissions = []
    from datetime import datetime, timezone
    for adm in admissions:
        if adm.id in invoiced_adm_ids:
            continue
        
        end_time = adm.discharge_datetime or datetime.now(timezone.utc)
        hours_stay = max(0.5, (end_time - adm.admission_datetime).total_seconds() / 3600.0)
        bed = adm.bed
        base_charge_24h = bed.category.base_charge_24h
        hourly_rate = bed.category.hourly_overtime_rate

        days = int(hours_stay // 24)
        rem_hours = hours_stay % 24
        if days == 0:
            current_bed_rent = base_charge_24h
        else:
            overtime_cost = rem_hours * hourly_rate if rem_hours > 2.0 else 0.0
            current_bed_rent = (days * base_charge_24h) + overtime_cost
        current_bed_rent = round(current_bed_rent, 2)

        items_res = await db.execute(select(IpdBillItem).where(IpdBillItem.admission_id == adm.id))
        past_items = items_res.scalars().all()

        unbilled_admissions.append({
            "id": str(adm.id),
            "bed_number": bed.bed_number,
            "category_name": bed.category.name,
            "admission_datetime": adm.admission_datetime.isoformat(),
            "hours_stayed": round(hours_stay, 1),
            "current_bed_rent": current_bed_rent,
            "past_items": [{
                "item_name": item.item_name,
                "total_price": float(item.total_price)
            } for item in past_items],
            "initial_deposit": float(adm.initial_deposit),
            "insurance_approved_amount": float(adm.insurance_approved_amount)
        })

    return ApiResponse.success(
        data={
            "consultations": unbilled_consultations,
            "treatment_plans": unbilled_plans,
            "ipd_admissions": unbilled_admissions,
            "standard_materials": materials
        },
        message="Pending charges calculated successfully."
    )


# ── 3. GET /billing/{invoice_id} ────────────────────────────────────────────────
@router.get(
    "/{invoice_id}",
    summary="Get invoice details",
)
async def get_invoice(
    invoice_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch details of a single invoice (accessible by involved patient or staff)."""
    service = BillingService(db)
    invoice = await service.get_invoice(invoice_id)

    # Permission check
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if invoice.patient_id != patient.id:
            raise PermissionDeniedError("Access to this invoice is denied.")

    return ApiResponse.success(
        data=invoice_to_out(invoice),
        message="Invoice details retrieved successfully.",
    )


# ── 4. PUT /billing/{invoice_id} ────────────────────────────────────────────────
@router.put(
    "/{invoice_id}",
    summary="Update invoice",
)
async def update_invoice(
    invoice_id: UUID,
    request: InvoiceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Update invoice details.
    - Restricted to Receptionists or Admins.
    """
    if current_user.role not in [UserRole.RECEPTIONIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only receptionists or admins can modify invoices.")

    service = BillingService(db)
    updated = await service.update_invoice(invoice_id, request)
    return ApiResponse.success(
        data=invoice_to_out(updated),
        message="Invoice updated successfully.",
    )





@router.get("/{invoice_id}/pdf", response_class=Response)
async def get_invoice_pdf(
    invoice_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Download the PDF for a specific invoice."""
    service = BillingService(db)
    invoice = await service.get_invoice(invoice_id)

    # Permission check
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if invoice.patient_id != patient.id:
            raise PermissionDeniedError("Access to this invoice is denied.")

    status_mapping = {
        "paid": "paid",
        "unpaid": "unpaid",
        "partially_paid": "partial"
    }
    status_class = status_mapping.get(invoice.status, "unpaid")
    
    pdf_items = []
    
    # 1. Consultation Fee
    if invoice.consultation:
        fee = invoice.consultation.doctor.consultation_fee or 500.0
        pdf_items.append({
            "description": f"Consultation Fee - Dr. {invoice.consultation.doctor.user.full_name}",
            "amount": float(fee)
        })
        
        # 2. Prescriptions / Medicines
        for presc in invoice.consultation.prescriptions:
            for item in presc.items:
                qty = item.quantity if (hasattr(item, "quantity") and item.quantity is not None) else calculate_medicine_qty(item.dosage, item.duration)
                price = 10.0
                if item.medicine:
                    price = item.medicine.unit_price or 10.0
                total = qty * price
                pdf_items.append({
                    "description": f"Medicine: {item.medicine_name} ({qty} units)",
                    "amount": float(total)
                })

    # 3. Treatment Plan Procedures
    if invoice.treatment_plan:
        for proc in invoice.treatment_plan.procedures:
            if proc.status == "completed":
                pdf_items.append({
                    "description": f"Procedure: {proc.procedure_name}",
                    "amount": float(proc.cost)
                })

    # 4. Clinical Materials / Used Things
    if invoice.treatment_plan:
        completed_count = sum(1 for p in invoice.treatment_plan.procedures if p.status == "completed")
        if completed_count > 0:
            pdf_items.append({
                "description": "Used Dental Materials & Sterile Consumables",
                "amount": completed_count * 200.0
            })
    elif invoice.consultation:
        pdf_items.append({
            "description": "Clinical Materials & Sterile Consumables",
            "amount": 150.0
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

    from app.utils.pdf_generator import generate_invoice_pdf
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
    invoice = await service.get_invoice(invoice_id)
    if not invoice:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Invoice not found."}
        )

    patient_email = invoice.patient.user.email
    if not patient_email:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "Patient does not have a registered email address."}
        )

    success = await service.send_invoice_email_to_patient(invoice_id)
    if success:
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": f"Invoice email sent successfully to {patient_email}"}
        )
    else:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to send email."}
        )

