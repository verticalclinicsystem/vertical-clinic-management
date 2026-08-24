"""
Appointments router — REST API endpoints for booking and managing clinic schedules.
"""
from __future__ import annotations

from datetime import datetime, time as dt_time, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_current_user_optional, get_db
from app.core.exceptions import BadRequestError, PermissionDeniedError
from app.core.rbac import UserRole
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentOut, AppointmentUpdate
from app.services.appointment_service import AppointmentService
from app.services.doctor_service import DoctorService
from app.services.patient_service import PatientService
from app.services.teleconsult_service import TeleConsultService
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
        role=current_user.role,
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
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
    branch_id: UUID | None = Query(None),
    consultation_type: str | None = Query(None),
) -> JSONResponse:
    """Retrieve all free availability slots (HH:MM) for a doctor on a specific date (YYYY-MM-DD)."""
    if branch_id:
        doctor_service = DoctorService(db)
        doctor = await doctor_service.get_doctor(doctor_id)
        if doctor.branch_id != branch_id:
            raise BadRequestError("Doctor does not practice at the selected branch.")

    service = AppointmentService(db)
    slots = await service.get_available_slots(doctor_id, date, consultation_type, current_user=current_user)
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

    items, _ = await service.list_appointments(
        page=1,
        limit=100,
        start_date=start_of_today,
        end_date=end_of_today,
    )

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


class RescheduleRequest(BaseModel):
    new_datetime: datetime | None = None
    appointment_datetime: datetime | None = None
    consultation_type: str | None = None


@router.patch("/{appointment_id}/reschedule")
@router.post("/{appointment_id}/reschedule")
async def reschedule_appointment_api(
    appointment_id: UUID,
    request: RescheduleRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Reschedule the appointment to a new date/time and optional consultation type."""
    target_dt = request.new_datetime or request.appointment_datetime
    if not target_dt:
        raise BadRequestError("Either new_datetime or appointment_datetime must be provided.")

    service = AppointmentService(db)
    update_data: dict[str, Any] = {"appointment_datetime": target_dt}
    if request.consultation_type:
        update_data["consultation_type"] = request.consultation_type

    updated = await service.update_appointment(
        appointment_id,
        AppointmentUpdate(**update_data),
        current_user_id=current_user.id,
        role=current_user.role,
    )
    return ApiResponse.success(data=to_appointment_out(updated, current_user.role), message="Appointment rescheduled.")


@router.get("/{appointment_id}/meeting-link", summary="Get meeting link for teleconsultation")
async def get_appointment_meeting_link(
    appointment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Get meeting link for a teleconsultation appointment."""
    tele_service = TeleConsultService(db)
    join_info = await tele_service.validate_and_join_meeting(appointment_id, current_user.id)
    room_name = join_info["meeting_url"]
    return ApiResponse.success(
        data={
            "meeting_link": f"https://meet.element.io/{room_name}",
            "room_name": room_name,
            "doctor_name": join_info.get("doctor_name"),
            "patient_name": join_info.get("patient_name"),
        },
        message="Meeting link retrieved successfully."
    )


class DoctorDelayRequest(BaseModel):
    delay_minutes: int


@router.post("/doctor/{doctor_id}/delay", summary="Broadcast emergency delay for a doctor")
async def broadcast_doctor_delay(
    doctor_id: UUID,
    request: DoctorDelayRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Broadcast doctor delay to all scheduled patients for today."""
    if current_user.role not in [UserRole.RECEPTIONIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only receptionists or admins can broadcast emergency delays.")
    
    service = AppointmentService(db)
    notified_count = await service.broadcast_emergency_delay(doctor_id, request.delay_minutes)
    
    return ApiResponse.success(
        data={"notified_count": notified_count},
        message=f"Successfully broadcasted delay of {request.delay_minutes} minutes to {notified_count} patients."
    )
