"""
Doctors router — REST API endpoints for doctor profiles and availability slots.
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
from app.schemas.doctor import DoctorOut, DoctorUpdate, DoctorSlotCreate, DoctorSlotOut
from app.services.doctor_service import DoctorService
from app.utils.response import ApiResponse

router = APIRouter()


# ── GET /doctors/me/dashboard ──────────────────────────────────────────────────
@router.get(
    "/me/dashboard",
    summary="Get doctor dashboard data",
)
async def get_doctor_dashboard(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch dashboard metrics, today's schedule, patient queue, and recent consultations for the logged-in doctor."""
    if current_user.role not in [UserRole.DOCTOR, UserRole.ADMIN]:
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("Only doctors can access the doctor dashboard.")
        
    service = DoctorService(db)
    dashboard_data = await service.get_doctor_dashboard(current_user.id)
    return ApiResponse.success(
        data=dashboard_data,
        message="Doctor dashboard data retrieved successfully.",
    )


# ── GET /doctors/me/follow-ups ───────────────────────────────────────────────
@router.get(
    "/me/follow-ups",
    summary="Get doctor follow-ups list",
)
async def get_doctor_followups(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve lists of advised follow-ups (pending booking) and booked follow-ups for the logged-in doctor."""
    if current_user.role not in [UserRole.DOCTOR, UserRole.ADMIN]:
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("Only doctors can access follow-ups data.")

    service = DoctorService(db)
    doctor = await service.get_doctor_by_user_id(current_user.id)
    doctor_id = doctor.id

    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.models.consultation import Consultation
    from app.models.patient import Patient
    from app.models.appointment import Appointment
    from datetime import datetime, timezone, timedelta

    # We load patient, patient's user, and branch
    stmt = (
        select(Consultation)
        .options(
            joinedload(Consultation.patient).joinedload(Patient.user),
            joinedload(Consultation.branch)
        )
        .where(
            Consultation.doctor_id == doctor_id,
            Consultation.followup_advised == True
        )
        .order_by(Consultation.consultation_datetime.desc())
    )
    result = await db.execute(stmt)
    consultations = list(result.scalars().all())

    # Get future appointments with the same doctor to check if they have booked a follow-up
    now = datetime.now(timezone.utc)
    appt_stmt = (
        select(Appointment)
        .options(
            joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Appointment.branch)
        )
        .where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_datetime > now,
            Appointment.status != "cancelled"
        )
    )
    appt_result = await db.execute(appt_stmt)
    future_appointments = list(appt_result.scalars().all())

    # Map them to pending vs booked followups
    pending_followups = []
    booked_followups = []

    for c in consultations:
        days = c.followup_after_days or 14
        recommended_date = c.consultation_datetime + timedelta(days=days)

        # Check if patient has any future booking with this doctor
        matching_future_appt = next(
            (appt for appt in future_appointments if appt.patient_id == c.patient_id),
            None
        )

        followup_info = {
            "consultation_id": str(c.id),
            "patient_name": c.patient.user.full_name if c.patient and c.patient.user else "Patient",
            "patient_code": c.patient.patient_code if c.patient else "PT-00000",
            "patient_id": str(c.patient_id),
            "consultation_date": c.consultation_datetime.isoformat(),
            "recommended_date": recommended_date.isoformat(),
            "treatment_type": f"Follow-up for {c.diagnosis}" if c.diagnosis else "Routine Follow-up",
            "notes": c.notes,
        }

        if matching_future_appt:
            followup_info["appointment_id"] = str(matching_future_appt.id)
            followup_info["appointment_datetime"] = matching_future_appt.appointment_datetime.isoformat()
            followup_info["appointment_status"] = matching_future_appt.status
            booked_followups.append(followup_info)
        else:
            pending_followups.append(followup_info)

    return ApiResponse.success(
        data={
            "pending": pending_followups,
            "booked": booked_followups
        },
        message="Doctor follow-ups data retrieved successfully."
    )


# ── 1. GET /doctors ───────────────────────────────────────────────────────────
@router.get(
    "/",
    summary="List and search doctors",
)
async def list_doctors(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Search by doctor name, specialization, or qualification"),
    branch_id: UUID | None = Query(None, description="Filter doctors by branch ID"),
) -> JSONResponse:
    """Get paginated, searchable, and branch-filtered list of doctors."""
    service = DoctorService(db)
    items, total = await service.get_all_doctors(
        page=page,
        limit=limit,
        search=search,
        branch_id=branch_id,
    )
    pages = (total + limit - 1) // limit

    return ApiResponse.success(
        data={
            "items": [DoctorOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Doctors retrieved successfully.",
    )


# ── 2. GET /doctors/{doctor_id} ────────────────────────────────────────────────
@router.get(
    "/{doctor_id}",
    summary="Get doctor profile details by ID",
)
async def get_doctor_details(
    doctor_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch details of a single doctor profile including user details and weekly availability slots."""
    service = DoctorService(db)
    doctor = await service.get_doctor(doctor_id)
    return ApiResponse.success(
        data=DoctorOut.model_validate(doctor),
        message="Doctor profile details retrieved successfully.",
    )


# ── 3. PUT /doctors/{doctor_id} ────────────────────────────────────────────────
@router.put(
    "/{doctor_id}",
    summary="Update doctor profile details",
)
async def update_doctor(
    doctor_id: UUID,
    request: DoctorUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Update qualification, fee, availability, bio, etc.
    Admins can update any doctor; doctors can only update their own profile.
    """
    service = DoctorService(db)
    doctor = await service.get_doctor(doctor_id)

    is_admin = current_user.role == UserRole.ADMIN
    is_owner = doctor.user_id == current_user.id

    if not (is_admin or is_owner):
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("You do not have permission to update this doctor profile.")

    updated = await service.update_doctor_profile(doctor_id, request)
    return ApiResponse.success(
        data=DoctorOut.model_validate(updated),
        message="Doctor profile updated successfully.",
    )


# ── 4. GET /doctors/{doctor_id}/slots ──────────────────────────────────────────
@router.get(
    "/{doctor_id}/slots",
    summary="Get doctor availability slots",
)
async def get_doctor_slots(
    doctor_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve weekly availability slots of a doctor."""
    service = DoctorService(db)
    slots = await service.get_doctor_slots(doctor_id)
    return ApiResponse.success(
        data=[DoctorSlotOut.model_validate(slot) for slot in slots],
        message="Doctor availability slots retrieved successfully.",
    )


# ── 5. POST /doctors/{doctor_id}/slots ─────────────────────────────────────────
@router.post(
    "/{doctor_id}/slots",
    summary="Set doctor availability slots (bulk)",
)
async def set_doctor_slots(
    doctor_id: UUID,
    request: list[DoctorSlotCreate],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Define weekly availability slots for a doctor. Replacing previous slots.
    Admins can define slots for any doctor; doctors can only define their own slots.
    """
    service = DoctorService(db)
    doctor = await service.get_doctor(doctor_id)

    is_admin = current_user.role == UserRole.ADMIN
    is_owner = doctor.user_id == current_user.id

    if not (is_admin or is_owner):
        from app.core.exceptions import PermissionDeniedError
        raise PermissionDeniedError("You do not have permission to define slots for this doctor.")

    slots = await service.set_doctor_slots(doctor_id, request)
    return ApiResponse.success(
        data=[DoctorSlotOut.model_validate(slot) for slot in slots],
        message="Doctor availability slots updated successfully.",
    )
