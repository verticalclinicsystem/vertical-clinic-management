"""
Teleconsultation router — endpoints for video/telehealth consultations.
"""
from typing import Annotated
import datetime
from datetime import timezone, timedelta
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole
from app.models.user import User
from app.utils.response import ApiResponse
from app.models.appointment import Appointment
from app.models.consultation import Consultation
from app.models.prescription import Prescription
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.services.patient_service import PatientService
from app.services.teleconsult_service import TeleConsultService
from app.core.exceptions import BadRequestError, PermissionDeniedError

router = APIRouter()


@router.get("/active", summary="Get active/upcoming teleconsultation")
async def get_active_teleconsultation(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Retrieve details of the active or next upcoming video/teleconsultation."""
    if current_user.role != UserRole.PATIENT:
        raise BadRequestError("Only patients can view teleconsultations.")
    
    patient_service = PatientService(db)
    patient = await patient_service.get_patient_by_user_id(current_user.id)
    if not patient:
        return ApiResponse.success(data=None, message="Patient profile not found.")

    now = datetime.datetime.now(timezone.utc)
    
    # Query upcoming or currently scheduled teleconsultations
    stmt = (
        select(Appointment)
        .where(
            Appointment.patient_id == patient.id,
            Appointment.consultation_type == "teleconsultation",
            Appointment.status.in_(["pending", "confirmed"])
        )
        .options(
            selectinload(Appointment.doctor).selectinload(Doctor.user),
            selectinload(Appointment.teleconsultation)
        )
        .order_by(Appointment.appointment_datetime.asc())
    )
    res = await db.execute(stmt)
    appts = res.scalars().all()
    
    # Find the first one that is either in the future or within the active window (2 hours)
    appt = None
    for a in appts:
        appt_dt = a.appointment_datetime
        if appt_dt.tzinfo is None:
            appt_dt = appt_dt.replace(tzinfo=timezone.utc)
        
        # Keep if it is in the future, or was scheduled within last 2 hours
        if appt_dt >= now - datetime.timedelta(hours=2):
            appt = a
            break
            
    if not appt:
        return ApiResponse.success(data=None, message="No active teleconsultation found.")

    appt_dt = appt.appointment_datetime
    if appt_dt.tzinfo is None:
        appt_dt = appt_dt.replace(tzinfo=timezone.utc)

    IST = timezone(timedelta(hours=5, minutes=30))
    appt_dt_ist = appt_dt.astimezone(IST)

    delta = appt_dt - now
    time_left_minutes = int(delta.total_seconds() / 60)
    
    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else ""
    specialty = appt.doctor.specialization if appt.doctor else ""
    
    # Auto-generate meeting link if within 15 minutes and doesn't exist
    if not appt.teleconsultation and time_left_minutes <= 15 and time_left_minutes >= -30:
        from app.services.teleconsult_service import TeleConsultService
        tele_service = TeleConsultService(db)
        try:
            tele_consult = await tele_service.generate_meeting_link(appt.id)
            appt.teleconsultation = tele_consult
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error auto-generating meeting link in active endpoint: {e}")

    meeting_link = appt.teleconsultation.meeting_url if appt.teleconsultation else None
    meeting_status = appt.teleconsultation.status if appt.teleconsultation else "Not Generated"
    
    # Check if user can join (starting 10 minutes before appointment up to 30 minutes after)
    can_join = False
    is_expired = False
    is_ongoing = False
    
    allowed_start = appt_dt - datetime.timedelta(minutes=10)
    allowed_end = appt_dt + datetime.timedelta(minutes=30)
    
    if appt.status in ("confirmed", "pending"):
        if allowed_start <= now <= allowed_end:
            can_join = True
            if now >= appt_dt:
                is_ongoing = True
        elif now > allowed_end:
            is_expired = True

    data = {
        "id": str(appt.id),
        "doctor_name": doctor_name,
        "specialty": specialty,
        "scheduled_time": appt_dt_ist.strftime("%d %b %Y at %I:%M %p"),
        "time_left_minutes": time_left_minutes,
        "meeting_link": meeting_link,
        "meeting_status": meeting_status,
        "can_join": can_join,
        "is_ongoing": is_ongoing,
        "is_expired": is_expired,
        "status": "scheduled"
    }
    
    return ApiResponse.success(
        data=data,
        message="Active teleconsultation fetched successfully."
    )


@router.post("/{appointment_id}/join", summary="Join teleconsultation meeting")
async def join_teleconsultation(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Validate and enter the video consultation room."""
    tele_service = TeleConsultService(db)
    join_info = await tele_service.validate_and_join_meeting(appointment_id, current_user.id)
    return ApiResponse.success(
        data=join_info,
        message="Meeting validation successful. You may join the video call."
    )


@router.post("/{appointment_id}/create-link", summary="Instantly generate meeting link (Doctor/Admin only)")
async def create_meeting_link(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Instantly generate meeting link for teleconsultation appointment."""
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise PermissionDeniedError("Only doctors or admins can generate meeting links instantly.")
        
    tele_service = TeleConsultService(db)
    tele_consult = await tele_service.generate_meeting_link(appointment_id)
    return ApiResponse.success(
        data={
            "meeting_url": tele_consult.meeting_url,
            "status": tele_consult.status
        },
        message="Meeting link generated instantly."
    )


@router.post("/{appointment_id}/end", summary="End teleconsultation meeting")
async def end_teleconsultation(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """End the video consultation call (Doctor or admin only)."""
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise PermissionDeniedError("Only clinicians can end the consultation.")
        
    tele_service = TeleConsultService(db)
"""
Teleconsultation router — endpoints for video/telehealth consultations.
"""
from typing import Annotated
import datetime
from datetime import timezone, timedelta
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole
from app.models.user import User
from app.utils.response import ApiResponse
from app.models.appointment import Appointment
from app.models.consultation import Consultation
from app.models.prescription import Prescription
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.services.patient_service import PatientService
from app.services.teleconsult_service import TeleConsultService
from app.core.exceptions import BadRequestError, PermissionDeniedError

router = APIRouter()


@router.get("/active", summary="Get active/upcoming teleconsultation")
async def get_active_teleconsultation(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Retrieve details of the active or next upcoming video/teleconsultation."""
    if current_user.role != UserRole.PATIENT:
        raise BadRequestError("Only patients can view teleconsultations.")
    
    patient_service = PatientService(db)
    patient = await patient_service.get_patient_by_user_id(current_user.id)
    if not patient:
        return ApiResponse.success(data=None, message="Patient profile not found.")

    now = datetime.datetime.now(timezone.utc)
    
    # Query upcoming or currently scheduled teleconsultations
    stmt = (
        select(Appointment)
        .where(
            Appointment.patient_id == patient.id,
            Appointment.consultation_type == "teleconsultation",
            Appointment.status.in_(["pending", "confirmed"])
        )
        .options(
            selectinload(Appointment.doctor).selectinload(Doctor.user),
            selectinload(Appointment.teleconsultation)
        )
        .order_by(Appointment.appointment_datetime.asc())
    )
    res = await db.execute(stmt)
    appts = res.scalars().all()
    
    # Find the first one that is either in the future or within the active window (2 hours)
    appt = None
    for a in appts:
        appt_dt = a.appointment_datetime
        if appt_dt.tzinfo is None:
            appt_dt = appt_dt.replace(tzinfo=timezone.utc)
        
        # Keep if it is in the future, or was scheduled within last 2 hours
        if appt_dt >= now - datetime.timedelta(hours=2):
            appt = a
            break
            
    if not appt:
        return ApiResponse.success(data=None, message="No active teleconsultation found.")

    appt_dt = appt.appointment_datetime
    if appt_dt.tzinfo is None:
        appt_dt = appt_dt.replace(tzinfo=timezone.utc)

    IST = timezone(timedelta(hours=5, minutes=30))
    appt_dt_ist = appt_dt.astimezone(IST)

    delta = appt_dt - now
    time_left_minutes = int(delta.total_seconds() / 60)
    
    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else ""
    specialty = appt.doctor.specialization if appt.doctor else ""
    
    # Auto-generate meeting link if within 15 minutes and doesn't exist
    if not appt.teleconsultation and time_left_minutes <= 15 and time_left_minutes >= -30:
        from app.services.teleconsult_service import TeleConsultService
        tele_service = TeleConsultService(db)
        try:
            tele_consult = await tele_service.generate_meeting_link(appt.id)
            appt.teleconsultation = tele_consult
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error auto-generating meeting link in active endpoint: {e}")

    meeting_link = appt.teleconsultation.meeting_url if appt.teleconsultation else None
    meeting_status = appt.teleconsultation.status if appt.teleconsultation else "Not Generated"
    
    # Check if user can join (starting 10 minutes before appointment up to 30 minutes after)
    can_join = False
    is_expired = False
    is_ongoing = False
    
    allowed_start = appt_dt - datetime.timedelta(minutes=10)
    allowed_end = appt_dt + datetime.timedelta(minutes=30)
    
    if appt.status in ("confirmed", "pending"):
        if allowed_start <= now <= allowed_end:
            can_join = True
            if now >= appt_dt:
                is_ongoing = True
        elif now > allowed_end:
            is_expired = True

    data = {
        "id": str(appt.id),
        "doctor_name": doctor_name,
        "specialty": specialty,
        "scheduled_time": appt_dt_ist.strftime("%d %b %Y at %I:%M %p"),
        "time_left_minutes": time_left_minutes,
        "meeting_link": meeting_link,
        "meeting_status": meeting_status,
        "can_join": can_join,
        "is_ongoing": is_ongoing,
        "is_expired": is_expired,
        "status": "scheduled"
    }
    
    return ApiResponse.success(
        data=data,
        message="Active teleconsultation fetched successfully."
    )


@router.post("/{appointment_id}/join", summary="Join teleconsultation meeting")
async def join_teleconsultation(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Validate and enter the video consultation room."""
    tele_service = TeleConsultService(db)
    join_info = await tele_service.validate_and_join_meeting(appointment_id, current_user.id)
    return ApiResponse.success(
        data=join_info,
        message="Meeting validation successful. You may join the video call."
    )


@router.post("/{appointment_id}/create-link", summary="Instantly generate meeting link (Doctor/Admin only)")
async def create_meeting_link(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Instantly generate meeting link for teleconsultation appointment."""
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise PermissionDeniedError("Only doctors or admins can generate meeting links instantly.")
        
    tele_service = TeleConsultService(db)
    tele_consult = await tele_service.generate_meeting_link(appointment_id)
    return ApiResponse.success(
        data={
            "meeting_url": tele_consult.meeting_url,
            "status": tele_consult.status
        },
        message="Meeting link generated instantly."
    )


@router.post("/{appointment_id}/end", summary="End teleconsultation meeting")
async def end_teleconsultation(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """End the video consultation call (Doctor or admin only)."""
    if current_user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise PermissionDeniedError("Only clinicians can end the consultation.")
        
    tele_service = TeleConsultService(db)
    await tele_service.end_meeting(appointment_id)
    return ApiResponse.success(
        message="Teleconsultation meeting has been closed successfully."
    )


@router.get("/checklist", summary="Get pre-consultation checklist")
async def get_pre_consultation_checklist(
    current_user: Annotated[User, Depends(get_current_user)]
) -> JSONResponse:
    """Retrieve checklist to complete before joining the video call."""
    checklist = [
        {"id": 1, "text": "Stable Internet connection tested", "completed": True},
        {"id": 2, "text": "Good lighting on your face", "completed": True},
        {"id": 3, "text": "Recent X-ray uploaded (optional)", "completed": True},
        {"id": 4, "text": "List of current symptoms ready", "completed": True}
    ]
    return ApiResponse.success(
        data=checklist,
        message="Pre-consultation checklist fetched successfully."
    )


@router.get("/past", summary="Get past teleconsultations")
async def get_past_teleconsultations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Retrieve past completed video consultations."""
    if current_user.role != UserRole.PATIENT:
        raise BadRequestError("Only patients can view teleconsultations.")

    patient_service = PatientService(db)
    patient = await patient_service.get_patient_by_user_id(current_user.id)
    if not patient:
        return ApiResponse.success(data=[], message="Patient profile not found.")

    stmt = (
        select(Appointment)
        .where(
            Appointment.patient_id == patient.id,
            Appointment.consultation_type == "teleconsultation",
            Appointment.status == "completed"
        )
        .options(selectinload(Appointment.doctor).selectinload(Doctor.user))
        .order_by(Appointment.appointment_datetime.desc())
    )
    res = await db.execute(stmt)
    appts = res.scalars().all()

    past_records = []
    for appt in appts:
        doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Doctor"
        specialty = appt.doctor.specialization if appt.doctor else ""
        appt_dt = appt.appointment_datetime
        if appt_dt.tzinfo is None:
            appt_dt = appt_dt.replace(tzinfo=timezone.utc)
        IST = timezone(timedelta(hours=5, minutes=30))
        appt_dt_ist = appt_dt.astimezone(IST)

        past_records.append({
            "id": str(appt.id),
            "doctor_name": doctor_name,
            "specialty": specialty,
            "date": appt_dt_ist.strftime("%d %b %Y"),
            "time": appt_dt_ist.strftime("%I:%M %p"),
            "status": "Completed"
        })

    return ApiResponse.success(data=past_records, message="Past teleconsultation history fetched successfully.")


@router.post("/{appointment_id}/signal-call", summary="Signal start of teleconsultation call")
async def signal_teleconsultation_call(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Trigger call signal for teleconsultation room."""
    tele_service = TeleConsultService(db)
    join_info = await tele_service.validate_and_join_meeting(appointment_id, current_user.id)
    
    stmt = select(Appointment).options(selectinload(Appointment.teleconsultation)).where(Appointment.id == appointment_id)
    res = await db.execute(stmt)
    appt = res.scalar_one_or_none()
    if appt and appt.teleconsultation:
        appt.teleconsultation.status = "calling"
        appt.teleconsultation.updated_at = datetime.datetime.now(timezone.utc)
        await db.commit()

    return ApiResponse.success(
        data=join_info,
        message="Call signal dispatched successfully."
    )


@router.get("/check-incoming-call", summary="Check for incoming teleconsultation call signal")
async def check_incoming_teleconsultation_call(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Check if there is an active incoming call signal for the current user."""
    from app.models.teleconsult import TeleConsultation

    now = datetime.datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(seconds=120)

    stmt = (
        select(Appointment)
        .options(
            selectinload(Appointment.patient).selectinload(Patient.user),
            selectinload(Appointment.doctor).selectinload(Doctor.user),
            selectinload(Appointment.teleconsultation)
        )
        .join(TeleConsultation, Appointment.id == TeleConsultation.appointment_id)
        .where(
            TeleConsultation.status.in_(["calling", "Active"]),
            TeleConsultation.updated_at >= recent_cutoff
        )
    )

    if current_user.role == UserRole.PATIENT:
        stmt = stmt.join(Patient, Appointment.patient_id == Patient.id).where(Patient.user_id == current_user.id)
    elif current_user.role == UserRole.DOCTOR:
        stmt = stmt.join(Doctor, Appointment.doctor_id == Doctor.id).where(Doctor.user_id == current_user.id)
    else:
        return ApiResponse.success(data={"has_incoming_call": False}, message="No call signal.")

    res = await db.execute(stmt)
    appts = res.scalars().all()

    if not appts:
        return ApiResponse.success(data={"has_incoming_call": False}, message="No incoming call.")

    active_appt = appts[0]
    tele = active_appt.teleconsultation
    clean_room = (tele.meeting_url or f"vclinicteleconsult{active_appt.id.hex[:12]}").lower().replace("_", "").replace("-", "")

    caller_name = active_appt.patient.user.full_name if current_user.role == UserRole.DOCTOR else active_appt.doctor.user.full_name
    caller_role = "patient" if current_user.role == UserRole.DOCTOR else "doctor"

    return ApiResponse.success(
        data={
            "has_incoming_call": True,
            "appointment_id": str(active_appt.id),
            "room_name": clean_room,
            "status": tele.status,
            "caller_name": caller_name,
            "caller_role": caller_role,
            "doctor_name": active_appt.doctor.user.full_name if active_appt.doctor and active_appt.doctor.user else "Doctor",
            "patient_name": active_appt.patient.user.full_name if active_appt.patient and active_appt.patient.user else "Patient",
        },
        message="Active incoming call signal detected."
    )


@router.post("/{appointment_id}/accept-call", summary="Accept incoming teleconsultation call")
async def accept_teleconsultation_call(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Accept incoming call and set status to Active."""
    tele_service = TeleConsultService(db)
    join_info = await tele_service.validate_and_join_meeting(appointment_id, current_user.id)
    
    stmt = select(Appointment).options(selectinload(Appointment.teleconsultation)).where(Appointment.id == appointment_id)
    res = await db.execute(stmt)
    appt = res.scalar_one_or_none()
    if appt and appt.teleconsultation:
        appt.teleconsultation.status = "Active"
        appt.teleconsultation.updated_at = datetime.datetime.now(timezone.utc)
        await db.commit()

    return ApiResponse.success(
        data=join_info,
        message="Call accepted successfully."
    )


@router.post("/{appointment_id}/decline-call", summary="Decline incoming teleconsultation call")
async def decline_teleconsultation_call(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Decline incoming call signal."""
    stmt = select(Appointment).options(selectinload(Appointment.teleconsultation)).where(Appointment.id == appointment_id)
    res = await db.execute(stmt)
    appt = res.scalar_one_or_none()
    if appt and appt.teleconsultation:
        appt.teleconsultation.status = "Ready"
        await db.commit()

    return ApiResponse.success(message="Call declined.")
