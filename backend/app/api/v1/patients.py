"""
Patients router — REST API endpoints for clinic patient profile management.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole, require_roles
from app.models.user import User
from app.schemas.patient import PatientOut, PatientUpdate, PatientCreate, FollowUpRecommendationOut, PatientPreferencesOut, PatientPreferencesUpdate
from app.services.patient_service import PatientService
from app.utils.response import ApiResponse

router = APIRouter()


# ── 1. GET /patients/me ───────────────────────────────────────────────────────
@router.get(
    "/me",
    summary="Get current patient's clinical profile",
)
async def get_my_patient_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve the clinical profile of the currently authenticated patient."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients have clinical profiles.")
    
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)
    return ApiResponse.success(
        data=PatientOut.model_validate(patient),
        message="Patient profile fetched successfully.",
    )


# ── 2. PATCH /patients/me ─────────────────────────────────────────────────────
@router.patch(
    "/me",
    summary="Update current patient's clinical profile",
)
async def update_my_patient_profile(
    request: PatientUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Update clinical details for the currently authenticated patient."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients have clinical profiles.")
    
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)
    updated = await service.update_patient_profile(patient.id, request)
    return ApiResponse.success(
        data=PatientOut.model_validate(updated),
        message="Your patient profile updated successfully.",
    )


# ── 2b. GET /patients/me/dashboard ────────────────────────────────────────────
@router.get(
    "/me/dashboard",
    summary="Get patient portal dashboard stats and lists",
)
async def get_patient_dashboard(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Fetch patient dashboard metadata, metric counts, upcoming appointments,
    recent prescriptions, bills, medical reports, follow-ups, and history.
    """
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients have a dashboard.")

    from app.services.appointment_service import AppointmentService
    from app.services.prescription_service import PrescriptionService
    from app.services.consultation_service import ConsultationService
    from app.services.billing_service import BillingService
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select, func

    # Import schemas
    from app.schemas.appointment import AppointmentOut
    from app.schemas.prescription import PrescriptionOut
    from app.schemas.consultation import ConsultationOut
    from app.schemas.medical_report import MedicalReportOut
    from app.schemas.invoice import InvoiceOut
    from app.schemas.patient import FollowUpRecommendationOut

    def to_patient_appt_out(a) -> AppointmentOut:
        out = AppointmentOut.model_validate(a)
        out.map_status_for_role("patient")
        return out

    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)
    patient_id = patient.id

    # 1. Preferred branch details
    branch_name = None
    if patient.preferred_branch_id:
        branch = await service.branch_repo.get_by_id(patient.preferred_branch_id)
        if branch:
            branch_name = branch.name

    # 2. Get appointments
    appt_service = AppointmentService(db)
    all_appts, _ = await appt_service.list_appointments(
        page=1,
        limit=100,
        patient_id=patient_id,
    )
    
    now = datetime.now(timezone.utc)
    upcoming_appointments = []
    appointment_history = []
    for appt in all_appts:
        if appt.appointment_datetime >= now and appt.status in ["pending", "confirmed"]:
            upcoming_appointments.append(appt)
        else:
            appointment_history.append(appt)

    # 3. Get prescriptions
    prescription_service = PrescriptionService(db)
    prescriptions, _ = await prescription_service.list_prescriptions(
        page=1,
        limit=50,
        patient_id=patient_id,
    )

    # 4. Get medical history (consultations)
    consultation_service = ConsultationService(db)
    consultations, _ = await consultation_service.list_consultations(
        page=1,
        limit=50,
        patient_id=patient_id,
    )

    # 5. Get medical reports
    from app.services.medical_report_service import MedicalReportService
    report_service = MedicalReportService(db)
    reports = await report_service.get_reports_by_user_id(current_user.id)


    # 6. Get bills (invoices)
    billing_service = BillingService(db)
    invoices, _ = await billing_service.list_invoices(
        page=1,
        limit=50,
        patient_id=patient_id,
    )

    # 7. Get balance due
    from app.models.invoice import Invoice
    balance_stmt = (
        select(func.sum(Invoice.balance_due))
        .where(
            Invoice.patient_id == patient_id,
            Invoice.status.in_(["unpaid", "partially_paid"])
        )
    )
    balance_res = await db.execute(balance_stmt)
    total_balance_due = float(balance_res.scalar() or 0.0)

    # 8. Get visits this year
    current_year = datetime.now(timezone.utc).year
    start_of_year = datetime(current_year, 1, 1, tzinfo=timezone.utc)
    from app.models.consultation import Consultation
    visits_stmt = (
        select(func.count(Consultation.id))
        .where(
            Consultation.patient_id == patient_id,
            Consultation.consultation_datetime >= start_of_year
        )
    )
    visits_res = await db.execute(visits_stmt)
    visits_this_year = visits_res.scalar_one()

    # 9. Get follow-ups
    from app.models.appointment import Appointment
    stmt = (
        select(Appointment)
        .where(
            Appointment.patient_id == patient_id,
            Appointment.status.in_(["pending", "confirmed"])
        )
    )
    result = await db.execute(stmt)
    future_appointments = list(result.scalars().all())

    follow_ups = []
    for c in consultations:
        recommended_date = c.consultation_datetime + timedelta(days=14)
        has_future_booking = any(
            appt.doctor_id == c.doctor_id and appt.appointment_datetime > c.consultation_datetime
            for appt in future_appointments
        )
        status = "booked" if has_future_booking else "recommended"

        treatment_type = "Routine Follow-up"
        if c.diagnosis:
            treatment_type = f"Follow-up for {c.diagnosis}"

        follow_ups.append({
            "id": c.id,
            "consultation_id": c.id,
            "doctor_id": c.doctor_id,
            "doctor_name": c.doctor.user.full_name if c.doctor and c.doctor.user else "Doctor",
            "branch_id": c.branch_id,
            "branch_name": c.branch.name if c.branch else "Main Branch",
            "recommended_date": recommended_date,
            "treatment_type": treatment_type,
            "notes": f"Recommended follow-up based on your visit on {c.consultation_datetime.strftime('%Y-%m-%d')}.",
            "status": status,
        })

    # Return unified payload supporting both simple statistics and full detail lists
    return ApiResponse.success(
        data={
            "patient_code": patient.patient_code,
            "full_name": patient.user.full_name if patient.user else None,
            "preferred_branch": branch_name,
            "upcoming_appointments_count": len(upcoming_appointments),
            "active_prescriptions_count": len(prescriptions),
            "balance_due": total_balance_due,
            "visits_this_year": visits_this_year,
            "upcoming_appointments": [to_patient_appt_out(a) for a in upcoming_appointments],
            "appointment_history": [to_patient_appt_out(a) for a in appointment_history],
            "past_appointments": [to_patient_appt_out(a) for a in appointment_history],
            "prescriptions": [PrescriptionOut.model_validate(p) for p in prescriptions],
            "recent_prescriptions": [PrescriptionOut.model_validate(p) for p in prescriptions],
            "medical_history": [ConsultationOut.model_validate(c) for c in consultations],
            "reports": [MedicalReportOut.model_validate(r) for r in reports],
            "bills": [InvoiceOut.model_validate(i) for i in invoices],
            "follow_ups": [FollowUpRecommendationOut.model_validate(f) for f in follow_ups],
        },
        message="Patient dashboard data fetched successfully.",
    )


# ── 2c. GET /patients/me/appointments ─────────────────────────────────────────
@router.get(
    "/me/appointments",
    summary="Get appointments of the logged-in patient",
)
async def list_my_appointments(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="Filter by status (pending, confirmed, completed, cancelled)"),
    date: str | None = Query(None, description="Filter by date (YYYY-MM-DD)"),
    search: str | None = Query(None, description="Search by doctor name or treatment type"),
) -> JSONResponse:
    """Retrieve paginated appointments for the logged-in patient with status, date, and search filters."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can query their appointments this way.")

    from app.services.appointment_service import AppointmentService
    from app.schemas.appointment import AppointmentOut
    
    # 1. Resolve current user to patient profile
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)

    # 2. Parse date if provided
    start_date = None
    end_date = None
    if date:
        try:
            from datetime import datetime, time as dt_time, timezone
            parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
            start_date = datetime.combine(parsed_date, dt_time.min, tzinfo=timezone.utc)
            end_date = datetime.combine(parsed_date, dt_time.max, tzinfo=timezone.utc)
        except ValueError:
            from app.core.exceptions import BadRequestError
            raise BadRequestError("Invalid date format. Expected YYYY-MM-DD.")

    # 3. Fetch appointments
    appt_service = AppointmentService(db)
    items, total = await appt_service.list_appointments(
        page=page,
        limit=limit,
        patient_id=patient.id,
        status=status,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )
    pages = (total + limit - 1) // limit

    def to_patient_appt_out(item):
        out = AppointmentOut.model_validate(item)
        out.map_status_for_role("patient")
        return out

    return ApiResponse.success(
        data={
            "items": [to_patient_appt_out(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Patient appointments retrieved successfully.",
    )


# ── 2d. GET /patients/me/prescriptions ────────────────────────────────────────
@router.get(
    "/me/prescriptions",
    summary="Get prescriptions of the logged-in patient",
)
async def list_my_prescriptions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> JSONResponse:
    """Retrieve paginated prescriptions for the logged-in patient."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can query their prescriptions this way.")

    from app.services.prescription_service import PrescriptionService
    from app.schemas.prescription import PrescriptionOut
    
    # 1. Resolve current user to patient profile
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)

    # 2. Fetch prescriptions
    presc_service = PrescriptionService(db)
    items, total = await presc_service.list_prescriptions(
        page=page,
        limit=limit,
        patient_id=patient.id,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [PrescriptionOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Patient prescriptions retrieved successfully.",
    )


# ── 2e. GET /patients/me/medical-history ──────────────────────────────────────
@router.get(
    "/me/medical-history",
    summary="Get medical history / visits of the logged-in patient",
)
async def list_my_medical_history(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> JSONResponse:
    """Retrieve paginated consultations/visits for the logged-in patient."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can query their medical history this way.")

    from app.services.consultation_service import ConsultationService
    from app.schemas.consultation import ConsultationOut

    # 1. Resolve current user to patient profile
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)

    # 2. Fetch consultations
    consultation_service = ConsultationService(db)
    items, total = await consultation_service.list_consultations(
        page=page,
        limit=limit,
        patient_id=patient.id,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [ConsultationOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Patient medical history retrieved successfully.",
    )


# ── 2f. GET /patients/me/treatments ───────────────────────────────────────────
@router.get(
    "/me/treatments",
    summary="Get treatments/treatment plans of the logged-in patient",
)
async def list_my_treatments(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
) -> JSONResponse:
    """Retrieve paginated treatment plans for the logged-in patient."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can query their treatments this way.")

    from app.services.treatment_service import TreatmentService
    from app.schemas.treatment import TreatmentPlanOut

    # 1. Resolve current user to patient profile
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)

    # 2. Fetch treatment plans
    treatment_service = TreatmentService(db)
    items, total = await treatment_service.list_treatment_plans(
        page=page,
        limit=limit,
        patient_id=patient.id,
        status=status,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [TreatmentPlanOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Patient treatments retrieved successfully.",
    )


# ── 2g. GET /patients/me/reports ──────────────────────────────────────────────
@router.get(
    "/me/reports",
    summary="Get medical reports of the logged-in patient",
)
async def list_my_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve all uploaded medical reports for the logged-in patient."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can query their reports this way.")

    from app.services.medical_report_service import MedicalReportService
    from app.schemas.medical_report import MedicalReportOut

    service = MedicalReportService(db)
    reports = await service.get_reports_by_user_id(current_user.id)
    return ApiResponse.success(
        data=[MedicalReportOut.model_validate(r) for r in reports],
        message="Patient medical reports retrieved successfully.",
    )


# ── 2i. GET /patients/me/follow-ups ───────────────────────────────────────────
@router.get(
    "/me/follow-ups",
    summary="Get recommended follow-ups for the logged-in patient",
)
async def list_my_follow_ups(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve recommended follow-ups based on the patient's previous consultations."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can query their follow-ups.")

    from app.services.consultation_service import ConsultationService
    from datetime import timedelta

    # 1. Resolve current user to patient profile
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)

    # 2. Get all patient's consultations (completed visits)
    consultation_service = ConsultationService(db)
    consultations, _ = await consultation_service.list_consultations(
        page=1,
        limit=100,
        patient_id=patient.id,
    )

    # 3. Get patient's scheduled appointments (future pending/confirmed)
    from sqlalchemy import select
    from app.models.appointment import Appointment
    stmt = (
        select(Appointment)
        .where(
            Appointment.patient_id == patient.id,
            Appointment.status.in_(["pending", "confirmed"])
        )
    )
    result = await db.execute(stmt)
    future_appointments = list(result.scalars().all())

    recommendations = []
    for c in consultations:
        # Only suggest follow-up if explicitly advised by the doctor
        if not getattr(c, "followup_advised", False):
            continue

        days = getattr(c, "followup_after_days", 14) or 14
        recommended_date = c.consultation_datetime + timedelta(days=days)
        
        # Check if there is already a future booked appointment with the same doctor
        has_future_booking = any(
            appt.doctor_id == c.doctor_id and appt.appointment_datetime > c.consultation_datetime
            for appt in future_appointments
        )
        status = "booked" if has_future_booking else "recommended"

        # Try to extract treatment type recommendation from diagnosis/notes/symptoms or default to Routine Follow-up
        treatment_type = "Routine Follow-up"
        if c.diagnosis:
            treatment_type = f"Follow-up for {c.diagnosis}"

        recommendations.append({
            "id": c.id,  # Use consultation id as recommendation id for uniqueness/relationship
            "consultation_id": c.id,
            "doctor_id": c.doctor_id,
            "doctor_name": c.doctor.user.full_name if c.doctor and c.doctor.user else "Doctor",
            "branch_id": c.branch_id,
            "branch_name": c.branch.name if c.branch else "Main Branch",
            "recommended_date": recommended_date,
            "treatment_type": treatment_type,
            "notes": f"Recommended follow-up based on your visit on {c.consultation_datetime.strftime('%Y-%m-%d')}.",
            "status": status,
        })

    return ApiResponse.success(
        data=[FollowUpRecommendationOut.model_validate(r) for r in recommendations],
        message="Patient follow-up recommendations retrieved successfully.",
    )


# ── 2h. GET /patients/me/billing ──────────────────────────────────────────────
@router.get(
    "/me/billing",
    summary="Get billing invoices of the logged-in patient",
)
async def list_my_billing(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="Filter by status (unpaid, partially_paid, paid, cancelled)"),
) -> JSONResponse:
    """Retrieve paginated invoices for the logged-in patient."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can query their invoices this way.")

    from app.services.billing_service import BillingService
    from app.schemas.invoice import InvoiceOut

    # 1. Resolve current user to patient profile
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)

    # 2. Fetch invoices
    billing_service = BillingService(db)
    items, total = await billing_service.list_invoices(
        page=page,
        limit=limit,
        patient_id=patient.id,
        status=status,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [InvoiceOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Patient billing invoices retrieved successfully.",
    )


# ── 2j. POST /patients/ (Create Walk-in Patient) ──────────────────────────────
@router.post(
    "/",
    summary="Create walk-in patient (staff/receptionist only)",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST))],
)
async def create_walkin_patient(
    request: PatientCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Create a new pre-verified patient record for walk-ins (bypassing OTP)."""
    service = PatientService(db)
    patient = await service.create_walkin_patient(request)
    return ApiResponse.success(
        data=PatientOut.model_validate(patient),
        message="Walk-in patient registered successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── 3. GET /patients ──────────────────────────────────────────────────────────



@router.get(
    "/",
    summary="List and search patients (staff only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST))],
)
async def list_patients(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Search by name, patient code, or phone number"),
) -> JSONResponse:
    """Get paginated, searchable list of clinic patients."""
    service = PatientService(db)
    items, total = await service.get_all_patients(page=page, limit=limit, search=search)
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [PatientOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Patients retrieved successfully.",
    )


# ── 4. GET /patients/{patient_id} ─────────────────────────────────────────────
@router.get(
    "/{patient_id}",
    summary="Get patient details by ID",
)
async def get_patient_details(
    patient_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Fetch profile details of a single patient by UUID.
    Staff/admins can view any profile; patients can only view their own.
    """
    service = PatientService(db)
    patient = await service.get_patient(patient_id)
    
    if current_user.role == UserRole.PATIENT and patient.user_id != current_user.id:
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("You are not allowed to view other patient profiles.")
        
    return ApiResponse.success(
        data=PatientOut.model_validate(patient),
        message="Patient details retrieved successfully.",
    )


# ── 5. PUT /patients/{patient_id} ─────────────────────────────────────────────
@router.put(
    "/{patient_id}",
    summary="Update patient details (staff or owner)",
)
async def update_patient(
    patient_id: UUID,
    request: PatientUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Update clinical details of a patient.
    Admins/receptionists can update any patient; patients can update their own.
    """
    service = PatientService(db)
    patient = await service.get_patient(patient_id)
    
    is_staff = current_user.role in (UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
    is_owner = patient.user_id == current_user.id
    
    if not (is_staff or is_owner):
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("You do not have permission to update this profile.")
        
    updated = await service.update_patient_profile(patient_id, request)
    return ApiResponse.success(
        data=PatientOut.model_validate(updated),
        message="Patient details updated successfully.",
    )


# ── 6. POST /patients/{patient_id}/deactivate ─────────────────────────────────
@router.post(
    "/{patient_id}/deactivate",
    summary="Deactivate patient (admin/receptionist only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST))],
)
async def deactivate_patient(
    patient_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Soft-deactivate a patient profile (sets is_active to False)."""
    service = PatientService(db)
    patient = await service.deactivate_patient(patient_id)
    return ApiResponse.success(
        data=PatientOut.model_validate(patient),
        message="Patient profile deactivated successfully.",
    )


# ── 7. POST /patients/{patient_id}/activate ───────────────────────────────────
@router.post(
    "/{patient_id}/activate",
    summary="Activate patient (admin/receptionist only)",
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.RECEPTIONIST))],
)
async def activate_patient(
    patient_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Re-activate a previously deactivated patient profile."""
    service = PatientService(db)
    patient = await service.activate_patient(patient_id)
    return ApiResponse.success(
        data=PatientOut.model_validate(patient),
        message="Patient profile activated successfully.",
    )


# ── 8. GET /patients/me/preferences ──────────────────────────────────────────
@router.get(
    "/me/preferences",
    summary="Get logged-in patient's preferences",
)
async def get_patient_preferences(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve language, notification, doctor, and consultation preferences."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients have preferences.")

    from app.schemas.patient import PatientPreferencesOut
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)
    return ApiResponse.success(
        data=PatientPreferencesOut.model_validate(patient),
        message="Patient preferences retrieved successfully.",
    )


# ── 9. PATCH / PUT /patients/me/preferences ──────────────────────────────────
@router.patch(
    "/me/preferences",
    summary="Update logged-in patient's preferences",
)
@router.put(
    "/me/preferences",
    summary="Update logged-in patient's preferences (PUT fallback)",
)
async def update_patient_preferences(
    request: PatientPreferencesUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Update language, notification, doctor, and consultation preferences."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can update preferences.")

    from app.schemas.patient import PatientPreferencesOut
    from app.schemas.patient import PatientPreferencesUpdate
    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)

    # Apply updates
    update_data = request.model_dump(exclude_unset=True)
    
    # Verify preferred doctor if provided
    if "preferred_doctor_id" in update_data and update_data["preferred_doctor_id"] is not None:
        from app.repositories.doctor_repo import DoctorRepository
        doctor_repo = DoctorRepository(db)
        doctor = await doctor_repo.get_by_id(update_data["preferred_doctor_id"])
        if not doctor:
            from app.core.exceptions import BadRequestError
            raise BadRequestError("Preferred doctor not found.")

    # Verify preferred branch if provided
    if "preferred_branch_id" in update_data and update_data["preferred_branch_id"] is not None:
        branch = await service.branch_repo.get_by_id(update_data["preferred_branch_id"])
        if not branch:
            from app.core.exceptions import BranchNotFoundError
            raise BranchNotFoundError()

    updated = await service.patient_repo.update(patient, update_data)
    await db.commit()

    return ApiResponse.success(
        data=PatientPreferencesOut.model_validate(updated),
        message="Patient preferences updated successfully.",
    )


# ── 10. GET /patients/me/statistics ──────────────────────────────────────────
@router.get(
    "/me/statistics",
    summary="Get logged-in patient's stats",
)
async def get_patient_statistics(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Get metrics including total visits, upcoming/cancelled/completed appointments, active Rx, bills, etc."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients have statistics.")

    from app.services.appointment_service import AppointmentService
    from app.services.prescription_service import PrescriptionService
    from app.services.consultation_service import ConsultationService
    from app.services.billing_service import BillingService
    from datetime import datetime, timezone
    from sqlalchemy import select, func

    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)
    patient_id = patient.id

    # 1. Appointments counts
    appt_service = AppointmentService(db)
    all_appts, _ = await appt_service.list_appointments(
        page=1,
        limit=1000,
        patient_id=patient_id,
    )
    
    upcoming_count = 0
    completed_count = 0
    cancelled_count = 0
    now = datetime.now(timezone.utc)
    
    for appt in all_appts:
        if appt.status == "cancelled":
            cancelled_count += 1
        elif appt.status == "completed" or (appt.appointment_datetime < now and appt.status in ["checked_in", "in_consultation"]):
            completed_count += 1
        elif appt.appointment_datetime >= now and appt.status in ["pending", "confirmed"]:
            upcoming_count += 1

    # 2. Active prescriptions count
    presc_service = PrescriptionService(db)
    prescs, _ = await presc_service.list_prescriptions(
        page=1,
        limit=1000,
        patient_id=patient_id,
    )
    active_prescriptions_count = len(prescs)

    # 3. Medical history (visits) count
    consult_service = ConsultationService(db)
    consults, _ = await consult_service.list_consultations(
        page=1,
        limit=1000,
        patient_id=patient_id,
    )
    total_visits = len(consults)

    # 4. Reports count
    from app.services.medical_report_service import MedicalReportService
    report_service = MedicalReportService(db)
    reports = await report_service.get_reports_by_user_id(current_user.id)
    uploaded_reports_count = len(reports)

    # 5. Pending bills count and balance due
    billing_service = BillingService(db)
    invoices, _ = await billing_service.list_invoices(
        page=1,
        limit=1000,
        patient_id=patient_id,
    )
    pending_bills_count = sum(1 for inv in invoices if inv.status in ["unpaid", "partially_paid"])
    
    from app.models.invoice import Invoice
    balance_stmt = (
        select(func.sum(Invoice.balance_due))
        .where(
            Invoice.patient_id == patient_id,
            Invoice.status.in_(["unpaid", "partially_paid"])
        )
    )
    balance_res = await db.execute(balance_stmt)
    total_balance_due = float(balance_res.scalar() or 0.0)

    # 6. Follow-up count
    from app.models.appointment import Appointment
    stmt = (
        select(Appointment)
        .where(
            Appointment.patient_id == patient_id,
            Appointment.status.in_(["pending", "confirmed"])
        )
    )
    result = await db.execute(stmt)
    future_appointments = list(result.scalars().all())
    
    follow_up_count = 0
    for c in consults:
        has_future_booking = any(
            appt.doctor_id == c.doctor_id and appt.appointment_datetime > c.consultation_datetime
            for appt in future_appointments
        )
        if not has_future_booking:
            follow_up_count += 1

    return ApiResponse.success(
        data={
            "total_visits": total_visits,
            "upcoming_appointments": upcoming_count,
            "cancelled_appointments": cancelled_count,
            "completed_appointments": completed_count,
            "active_prescriptions": active_prescriptions_count,
            "pending_bills": pending_bills_count,
            "balance_due": total_balance_due,
            "uploaded_reports": uploaded_reports_count,
            "follow_up_count": follow_up_count,
        },
        message="Patient statistics retrieved successfully.",
    )


# ── 11. GET /patients/me/timeline ────────────────────────────────────────────
@router.get(
    "/me/timeline",
    summary="Get patient's medical history timeline",
)
async def get_patient_timeline(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve a chronologically ordered feed of visits, prescriptions, reports, invoices, and follow-ups."""
    if current_user.role != UserRole.PATIENT:
        from app.core.exceptions import BadRequestError
        raise BadRequestError("Only patients can view their timeline.")

    from app.services.prescription_service import PrescriptionService
    from app.services.consultation_service import ConsultationService
    from app.services.billing_service import BillingService
    from app.services.medical_report_service import MedicalReportService
    from datetime import timedelta

    service = PatientService(db)
    patient = await service.get_patient_by_user_id(current_user.id)
    patient_id = patient.id

    timeline = []

    # 1. Fetch Consultations (Visits)
    consult_service = ConsultationService(db)
    consults, _ = await consult_service.list_consultations(page=1, limit=100, patient_id=patient_id)
    for c in consults:
        timeline.append({
            "event_type": "visit",
            "title": f"Consultation with Dr. {c.doctor.user.full_name if c.doctor and c.doctor.user else 'Doctor'}",
            "datetime": c.consultation_datetime.isoformat(),
            "details": {
                "diagnosis": c.diagnosis,
                "symptoms": c.symptoms,
                "notes": c.notes,
            }
        })

    # 2. Fetch Prescriptions
    presc_service = PrescriptionService(db)
    prescs, _ = await presc_service.list_prescriptions(page=1, limit=100, patient_id=patient_id)
    for p in prescs:
        timeline.append({
            "event_type": "prescription",
            "title": f"Prescription Issued by Dr. {p.doctor.user.full_name if p.doctor and p.doctor.user else 'Doctor'}",
            "datetime": p.created_at.isoformat(),
            "details": {
                "prescription_id": str(p.id),
                "medicines": [
                    {
                        "name": item.medicine_name,
                        "dosage": item.dosage,
                        "duration": item.duration,
                        "instructions": item.instructions
                    } for item in p.items
                ]
            }
        })

    # 3. Fetch Reports
    report_service = MedicalReportService(db)
    reports = await report_service.get_reports_by_user_id(current_user.id)
    for r in reports:
        timeline.append({
            "event_type": "report",
            "title": f"Medical Report Uploaded: {r.report_name}",
            "datetime": r.uploaded_at.isoformat(),
            "details": {
                "report_id": str(r.id),
                "report_type": r.report_type,
                "file_url": r.file_url
            }
        })

    # 4. Fetch Invoices (Bills)
    billing_service = BillingService(db)
    invoices, _ = await billing_service.list_invoices(page=1, limit=100, patient_id=patient_id)
    for inv in invoices:
        timeline.append({
            "event_type": "invoice",
            "title": f"Invoice Generated - {inv.invoice_number}",
            "datetime": inv.created_at.isoformat(),
            "details": {
                "invoice_id": str(inv.id),
                "total_amount": float(inv.total_amount),
                "balance_due": float(inv.balance_due),
                "status": inv.status
            }
        })

    # 5. Fetch Follow-up Recommendations
    from sqlalchemy import select
    from app.models.appointment import Appointment
    stmt = (
        select(Appointment)
        .where(
            Appointment.patient_id == patient_id,
            Appointment.status.in_(["pending", "confirmed"])
        )
    )
    result = await db.execute(stmt)
    future_appointments = list(result.scalars().all())

    for c in consults:
        recommended_date = c.consultation_datetime + timedelta(days=14)
        has_future_booking = any(
            appt.doctor_id == c.doctor_id and appt.appointment_datetime > c.consultation_datetime
            for appt in future_appointments
        )
        status = "booked" if has_future_booking else "recommended"

        timeline.append({
            "event_type": "followup",
            "title": f"Follow-up Recommended with Dr. {c.doctor.user.full_name if c.doctor and c.doctor.user else 'Doctor'}",
            "datetime": recommended_date.isoformat(),
            "details": {
                "consultation_id": str(c.id),
                "status": status,
                "notes": f"Based on visit on {c.consultation_datetime.strftime('%Y-%m-%d')} for {c.diagnosis or 'Routine'}"
            }
        })

    # Sort timeline by datetime descending
    timeline.sort(key=lambda x: x["datetime"], reverse=True)

    return ApiResponse.success(
        data=timeline,
        message="Patient medical timeline retrieved successfully.",
    )
