"""
Appointments router — REST API endpoints for booking and managing clinic schedules.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID
from datetime import datetime, timezone, time as dt_time

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole
from app.core.exceptions import PermissionDeniedError, BadRequestError
from app.models.user import User
from app.schemas.appointment import AppointmentOut, AppointmentCreate, AppointmentUpdate
from app.services.appointment_service import AppointmentService
from app.services.patient_service import PatientService
from app.utils.response import ApiResponse

router = APIRouter()


def to_appointment_out(item, role: str) -> AppointmentOut:
    out = AppointmentOut.model_validate(item)
    out.map_status_for_role(role)
    return out


# ── 1. POST /appointments ──────────────────────────────────────────────────────
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Book a new appointment",
)
async def book_appointment(
    request: AppointmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Book a new appointment.
    If logged in as a patient, patient_id is automatically set to the logged-in profile.
    If logged in as staff/admin, a patient_id must be provided in the request body.
    """
    service = AppointmentService(db)
    
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        target_patient_id = patient.id
    else:
        if not request.patient_id:
            raise BadRequestError("patient_id is required for staff booking.")
        target_patient_id = request.patient_id

    appointment = await service.create_appointment(
        patient_id=target_patient_id,
        request=request,
    )
    return ApiResponse.success(
        data=to_appointment_out(appointment, current_user.role),
        message="Appointment booked successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── GET /appointments/available-slots ──────────────────────────────────────────
@router.get(
    "/available-slots",
    summary="Get available doctor slots",
)
async def get_available_slots(
    doctor_id: UUID,
    date: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    branch_id: UUID | None = Query(None),
    consultation_type: str | None = Query(None),
) -> JSONResponse:
    """Retrieve all free availability slots (HH:MM) for a doctor on a specific date (YYYY-MM-DD)."""
    if branch_id:
        from app.services.doctor_service import DoctorService
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor(doctor_id)
        if doctor.branch_id != branch_id:
            raise BadRequestError("Doctor does not practice at the selected branch.")

    service = AppointmentService(db)
    slots = await service.get_available_slots(doctor_id, date, consultation_type)
    return ApiResponse.success(
        data=slots,
        message="Available slots retrieved successfully.",
    )



# ── GET /appointments/calendar ────────────────────────────────────────────────
@router.get(
    "/calendar",
    summary="Get calendar appointments",
)
async def get_calendar(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
) -> JSONResponse:
    """Fetch appointments within a date range for calendar rendering."""
    service = AppointmentService(db)
    patient_id = None
    doctor_id = None

    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        patient_id = patient.id
    elif current_user.role == UserRole.DOCTOR:
        from app.services.doctor_service import DoctorService
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        doctor_id = doctor.id

    items, _ = await service.list_appointments(
        page=1,
        limit=1000,
        patient_id=patient_id,
        doctor_id=doctor_id,
        start_date=start_date,
        end_date=end_date,
    )
    return ApiResponse.success(
        data=[to_appointment_out(item, current_user.role) for item in items],
        message="Calendar appointments retrieved successfully.",
    )


# ── GET /appointments/waiting-queue ───────────────────────────────────────────
@router.get(
    "/waiting-queue",
    summary="Get patient waiting queue",
)
async def get_waiting_queue(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """Fetch patients currently checked-in and waiting or in consultation today."""
    service = AppointmentService(db)
    today = datetime.now(timezone.utc).date()
    start_of_today = datetime.combine(today, dt_time.min, tzinfo=timezone.utc)
    end_of_today = datetime.combine(today, dt_time.max, tzinfo=timezone.utc)

    # We fetch for today
    items, _ = await service.list_appointments(
        page=1,
        limit=100,
        start_date=start_of_today,
        end_date=end_of_today,
    )

    # Filter to only checked_in, Waiting, or In Consultation status values
    queue_statuses = ["Waiting", "checked_in", "In Consultation", "in_consultation"]
    queue_items = [item for item in items if item.status in queue_statuses]

    return ApiResponse.success(
        data=[to_appointment_out(item, current_user.role) for item in queue_items],
        message="Waiting queue retrieved successfully.",
    )


# ── GET /appointments/today ───────────────────────────────────────────────────
@router.get(
    "/today",
    summary="Get today's appointments",
)
async def get_today_appointments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> JSONResponse:
    """Fetch all appointments scheduled for today."""
    service = AppointmentService(db)
    today = datetime.now(timezone.utc).date()
    start_of_today = datetime.combine(today, dt_time.min, tzinfo=timezone.utc)
    end_of_today = datetime.combine(today, dt_time.max, tzinfo=timezone.utc)

    patient_id = None
    doctor_id = None
    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        patient_id = patient.id
    elif current_user.role == UserRole.DOCTOR:
        from app.services.doctor_service import DoctorService
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        doctor_id = doctor.id

    items, _ = await service.list_appointments(
        page=1,
        limit=100,
        patient_id=patient_id,
        doctor_id=doctor_id,
        start_date=start_of_today,
        end_date=end_of_today,
    )
    return ApiResponse.success(
        data=[to_appointment_out(item, current_user.role) for item in items],
        message="Today's appointments retrieved successfully.",
    )


# ── 2. GET /appointments ───────────────────────────────────────────────────────
@router.get(
    "/",
    summary="List/search appointments",
)
async def list_appointments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: UUID | None = Query(None),
    doctor_id: UUID | None = Query(None),
    branch_id: UUID | None = Query(None),
    status: str | None = Query(None),
    rescheduled: bool | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    search: str | None = Query(None),
) -> JSONResponse:
    """
    List appointments.
    - Patients are restricted to viewing only their own appointments.
    - Doctors are restricted to viewing only their own appointments.
    - Staff/Admin can view all appointments.
    """
    service = AppointmentService(db)
    patient_service = PatientService(db)

    if current_user.role == UserRole.PATIENT:
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        patient_id = patient.id
    elif current_user.role == UserRole.DOCTOR:
        from app.services.doctor_service import DoctorService
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        doctor_id = doctor.id

    items, total = await service.list_appointments(
        page=page,
        limit=limit,
        patient_id=patient_id,
        doctor_id=doctor_id,
        branch_id=branch_id,
        status=status,
        rescheduled=rescheduled,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )
    pages = (total + limit - 1) // limit


    return ApiResponse.success(
        data={
            "items": [to_appointment_out(item, current_user.role) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
        message="Appointments retrieved successfully.",
    )


# ── 3. GET /appointments/{appointment_id} ──────────────────────────────────────
@router.get(
    "/{appointment_id}",
    summary="Get appointment details",
)
async def get_appointment(
    appointment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Fetch details of a single appointment (accessible by involved patient/doctor or staff)."""
    service = AppointmentService(db)
    appointment = await service.get_appointment(appointment_id)

    if current_user.role == UserRole.PATIENT:
        patient_service = PatientService(db)
        patient = await patient_service.get_patient_by_user_id(current_user.id)
        if appointment.patient_id != patient.id:
            raise PermissionDeniedError("Access to this appointment is denied.")
    elif current_user.role == UserRole.DOCTOR:
        from app.services.doctor_service import DoctorService
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor_by_user_id(current_user.id)
        if appointment.doctor_id != doctor.id:
            raise PermissionDeniedError("Access to this appointment is denied.")

    return ApiResponse.success(
        data=to_appointment_out(appointment, current_user.role),
        message="Appointment details retrieved successfully.",
    )


# ── 4. PUT /appointments/{appointment_id} ──────────────────────────────────────
@router.put(
    "/{appointment_id}",
    summary="Update or reschedule appointment",
)
async def update_appointment(
    appointment_id: UUID,
    request: AppointmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """
    Reschedule date/time, add notes, or cancel appointment status.
    Involved patients can reschedule/cancel. Staff/Admins can perform any updates.
    """
    service = AppointmentService(db)
    updated = await service.update_appointment(
        appointment_id,
        request,
        current_user_id=current_user.id,
        role=current_user.role,
    )
    return ApiResponse.success(
        data=to_appointment_out(updated, current_user.role),
        message="Appointment updated successfully.",
    )


# ── PATCH /appointments/{appointment_id} ──────────────────────────────────────
@router.patch(
    "/{appointment_id}",
    summary="Partially update appointment details",
)
async def patch_appointment(
    appointment_id: UUID,
    request: AppointmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Perform partial modifications to appointment fields (notes, status, or date/time)."""
    return await update_appointment(appointment_id, request, current_user, db)


# ── Action transitions ────────────────────────────────────────────────────────
@router.patch("/{appointment_id}/confirm")
async def confirm_appointment_api(
    appointment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Confirm the booking (restricted to staff/admin)."""
    if current_user.role not in [UserRole.RECEPTIONIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only receptionists or admins can confirm appointments.")
    service = AppointmentService(db)
    updated = await service.update_appointment(
        appointment_id,
        AppointmentUpdate(status="confirmed"),
        current_user_id=current_user.id,
        role=current_user.role,
    )
    return ApiResponse.success(data=to_appointment_out(updated, current_user.role), message="Appointment confirmed.")


@router.patch("/{appointment_id}/check-in")
async def checkin_appointment_api(
    appointment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Mark the patient as arrived / checked-in."""
    if current_user.role not in [UserRole.RECEPTIONIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only receptionists or admins can check-in patients.")
    service = AppointmentService(db)
    updated = await service.update_appointment(
        appointment_id,
        AppointmentUpdate(status="checked_in"),
        current_user_id=current_user.id,
        role=current_user.role,
    )
    return ApiResponse.success(data=to_appointment_out(updated, current_user.role), message="Patient checked in successfully.")


@router.patch("/{appointment_id}/start")
async def start_consultation_api(
    appointment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Mark consultation as started (In Consultation)."""
    if current_user.role not in [UserRole.DOCTOR, UserRole.ADMIN]:
        raise PermissionDeniedError("Only doctors or admins can start consultations.")
    service = AppointmentService(db)
    updated = await service.update_appointment(
        appointment_id,
        AppointmentUpdate(status="in_consultation"),
        current_user_id=current_user.id,
        role=current_user.role,
    )
    return ApiResponse.success(data=to_appointment_out(updated, current_user.role), message="Consultation started.")


@router.patch("/{appointment_id}/complete")
async def complete_appointment_api(
    appointment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Mark appointment as completed."""
    if current_user.role not in [UserRole.DOCTOR, UserRole.ADMIN]:
        raise PermissionDeniedError("Only doctors or admins can complete consultations.")
    service = AppointmentService(db)
    updated = await service.update_appointment(
        appointment_id,
        AppointmentUpdate(status="completed"),
        current_user_id=current_user.id,
        role=current_user.role,
    )
    return ApiResponse.success(data=to_appointment_out(updated, current_user.role), message="Appointment completed.")


@router.patch("/{appointment_id}/cancel")
async def cancel_appointment_api(
    appointment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Cancel the appointment."""
    service = AppointmentService(db)
    updated = await service.update_appointment(
        appointment_id,
        AppointmentUpdate(status="cancelled"),
        current_user_id=current_user.id,
        role=current_user.role,
    )
    return ApiResponse.success(data=to_appointment_out(updated, current_user.role), message="Appointment cancelled.")


from pydantic import BaseModel

class RescheduleRequest(BaseModel):
    new_datetime: datetime | None = None
    appointment_datetime: datetime | None = None

@router.patch("/{appointment_id}/reschedule")
async def reschedule_appointment_api(
    appointment_id: UUID,
    request: RescheduleRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Reschedule the appointment to a new date/time."""
    target_dt = request.new_datetime or request.appointment_datetime
    if not target_dt:
        raise BadRequestError("Either new_datetime or appointment_datetime must be provided.")

    service = AppointmentService(db)
    updated = await service.update_appointment(
        appointment_id,
        AppointmentUpdate(appointment_datetime=target_dt),
        current_user_id=current_user.id,
        role=current_user.role,
    )
    return ApiResponse.success(data=to_appointment_out(updated, current_user.role), message="Appointment rescheduled.")

