"""
Teleconsultation router — endpoints for video/telehealth consultations.
"""
from typing import Annotated
import uuid
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.rbac import UserRole
from app.models.user import User
from app.utils.response import ApiResponse
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

    service = TeleConsultService(db)
    data = await service.get_active_teleconsultation(current_user.id)
    if not data:
        return ApiResponse.success(data=None, message="No active teleconsultation found.")

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
    service = TeleConsultService(db)
    join_info = await service.validate_and_join_meeting(appointment_id, current_user.id)
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
        
    service = TeleConsultService(db)
    result = await service.create_meeting_link_instantly(appointment_id, current_user.full_name)

    return ApiResponse.success(
        data=result,
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
        
    service = TeleConsultService(db)
    await service.end_meeting(appointment_id)
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

    service = TeleConsultService(db)
    past_records = await service.get_past_teleconsultations(current_user.id)
    return ApiResponse.success(
        data=past_records,
        message="Past teleconsultation history fetched successfully."
    )


@router.post("/{appointment_id}/signal-call", summary="Signal start of teleconsultation call")
async def signal_teleconsultation_call(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Trigger call signal for teleconsultation room."""
    service = TeleConsultService(db)
    join_info = await service.signal_teleconsultation_call(appointment_id, current_user.id)
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
    service = TeleConsultService(db)
    call_info = await service.check_incoming_call(current_user)
    return ApiResponse.success(
        data=call_info,
        message="Active incoming call signal detected."
    )


@router.post("/{appointment_id}/accept-call", summary="Accept incoming teleconsultation call")
async def accept_teleconsultation_call(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Accept incoming call and set status to Active."""
    service = TeleConsultService(db)
    join_info = await service.accept_call(appointment_id, current_user.id)
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
    service = TeleConsultService(db)
    await service.decline_call(appointment_id)
    return ApiResponse.success(message="Call declined.")


@router.post("/{appointment_id}/patient-ready", summary="Notify doctor that patient is ready in lobby")
async def patient_ready_in_lobby(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Notify the doctor that the patient is in the waiting lobby."""
    service = TeleConsultService(db)
    await service.patient_ready_in_lobby(appointment_id, current_user.id)
    return ApiResponse.success(
        message="Doctor has been notified that you are ready in the waiting lobby."
    )


@router.post("/{appointment_id}/patient-left", summary="Notify doctor that patient left the lobby")
async def patient_left_lobby(
    appointment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> JSONResponse:
    """Notify the doctor that the patient left the waiting lobby."""
    service = TeleConsultService(db)
    await service.patient_left_lobby(appointment_id, current_user.id)
    return ApiResponse.success(
        message="Lobby reset signal sent."
    )
