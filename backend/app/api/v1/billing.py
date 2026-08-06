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
    """Convert an Invoice ORM object to InvoiceOut dict, enriching with prescription items."""
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

    # Attach prescription items from the linked consultation (for bill breakdown)
    items = []
    if invoice.consultation and hasattr(invoice.consultation, 'prescriptions'):
        for presc in invoice.consultation.prescriptions:
            if hasattr(presc, 'items'):
                for item in presc.items:
                    items.append({
                        "medicine_name": item.medicine_name,
                        "dosage": item.dosage,
                        "duration": item.duration,
                        "instructions": item.instructions,
                    })
    data["prescription_items"] = items
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

    return ApiResponse.success(
        data={
            "consultations": unbilled_consultations,
            "treatment_plans": unbilled_plans,
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
                "amount": float(completed_count * 200.0)
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

    status_mapping = {
        "paid": "paid",
        "unpaid": "unpaid",
        "partially_paid": "partial"
    }
    status_class = status_mapping.get(invoice.status, "unpaid")
    
    pdf_items = []
    if invoice.consultation:
        fee = invoice.consultation.doctor.consultation_fee or 500.0
        pdf_items.append({
            "description": f"Consultation Fee - Dr. {invoice.consultation.doctor.user.full_name}",
            "amount": float(fee)
        })
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

    if invoice.treatment_plan:
        for proc in invoice.treatment_plan.procedures:
            if proc.status == "completed":
                pdf_items.append({
                    "description": f"Procedure: {proc.procedure_name}",
                    "amount": float(proc.cost)
                })

    if invoice.treatment_plan:
        completed_count = sum(1 for p in invoice.treatment_plan.procedures if p.status == "completed")
        if completed_count > 0:
            pdf_items.append({
                "description": "Used Dental Materials & Sterile Consumables",
                "amount": float(completed_count * 200.0)
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

    from app.utils.email import send_email
    subject = f"Invoice {invoice.invoice_number} from Vertical Clinic"
    plain_body = (
        f"Dear {invoice.patient.user.full_name},\n\n"
        f"Please find attached your invoice {invoice.invoice_number} for your recent visit at Vertical Clinic.\n"
        f"Grand Total: ₹{invoice.grand_total:.2f}\n"
        f"Amount Paid: ₹{invoice.amount_paid:.2f}\n"
        f"Balance Due: ₹{invoice.balance_due:.2f}\n\n"
        f"Thank you for choosing Vertical Clinic.\n\n"
        f"Best regards,\n"
        f"Vertical Clinic Team"
    )
    html_body = (
        f"<h3>Invoice Details</h3>"
        f"<p>Dear <strong>{invoice.patient.user.full_name}</strong>,</p>"
        f"<p>Please find attached your invoice <strong>{invoice.invoice_number}</strong> for your recent visit at Vertical Clinic.</p>"
        f"<ul>"
        f"<li><strong>Grand Total:</strong> ₹{invoice.grand_total:.2f}</li>"
        f"<li><strong>Amount Paid:</strong> ₹{invoice.amount_paid:.2f}</li>"
        f"<li><strong>Balance Due:</strong> <span style='color: {'green' if invoice.balance_due == 0 else 'red'}; font-weight: bold;'>₹{invoice.balance_due:.2f}</span></li>"
        f"</ul>"
        f"<p>Thank you for choosing Vertical Clinic.</p>"
        f"<br/><hr/><p style='font-size: 11px; color: #888;'>This is an automated email. Please do not reply directly.</p>"
    )
    
    attachments = [
        (f"invoice_{invoice.invoice_number}.pdf", pdf_bytes, "application/pdf")
    ]
    
    try:
        await send_email(
            to=patient_email,
            subject=subject,
            html_body=html_body,
            plain_body=plain_body,
            attachments=attachments
        )
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": f"Invoice email sent successfully to {patient_email}"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Failed to send email: {str(e)}"}
        )

