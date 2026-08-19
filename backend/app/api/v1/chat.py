"""
Direct Messaging & Patient Chat Router — Separate modular section for patient-clinic messaging.
"""
from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.core.exceptions import BadRequestError, NotFoundError, PermissionDeniedError
from app.models.appointment import Appointment
from app.models.chat import ChatMessage
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageOut
from app.utils.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()


# ── 1. POST /chat/send ────────────────────────────────────────────────────────
@router.post(
    "/send",
    summary="Send direct message for an appointment",
    status_code=status.HTTP_201_CREATED,
)
async def send_chat_message(
    request: ChatMessageCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Send a direct message linked to a specific appointment."""
    # 1. Fetch appointment details with patient and doctor relations
    stmt = (
        select(Appointment)
        .where(Appointment.id == request.appointment_id)
        .options(
            selectinload(Appointment.patient).selectinload(Patient.user),
            selectinload(Appointment.doctor).selectinload(Doctor.user),
        )
    )
    res = await db.execute(stmt)
    appt = res.scalar_one_or_none()
    if not appt:
        raise NotFoundError("Appointment not found.")

    # 2. Permission check & receiver determination
    patient_user_id = appt.patient.user_id if (appt.patient and appt.patient.user_id) else None
    doctor_user_id = appt.doctor.user_id if (appt.doctor and appt.doctor.user_id) else None

    # Fallback to admin if doctor or patient user link is missing
    if not doctor_user_id:
        admin_res = await db.execute(select(User.id).where(User.role == "admin").limit(1))
        doctor_user_id = admin_res.scalar_one_or_none()

    if current_user.role == "patient" or current_user.id == patient_user_id:
        patient_user_id = current_user.id
        receiver_id = request.receiver_id or doctor_user_id
    elif current_user.id == doctor_user_id or current_user.role in ("doctor", "receptionist", "admin", "clinic_manager"):
        receiver_id = request.receiver_id or patient_user_id
    else:
        raise PermissionDeniedError("You do not have permission to chat regarding this appointment.")

    if not receiver_id:
        # Emergency fallback receiver: any admin/manager
        admin_res = await db.execute(select(User.id).where(User.role.in_(["admin", "clinic_manager"])).limit(1))
        receiver_id = admin_res.scalar_one_or_none()

    try:
        # 3. Create and persist message
        new_msg = ChatMessage(
            appointment_id=request.appointment_id,
            sender_id=current_user.id,
            receiver_id=receiver_id,
            message_text=request.message_text.strip(),
            is_read=False,
        )
        db.add(new_msg)
        await db.commit()
        await db.refresh(new_msg)

        # 3b. Automatic Clinic Desk Responder (Auto-reply when Patient messages Clinic/Doctor)
        if (current_user.id == patient_user_id or current_user.role == "patient") and receiver_id:
            msg_text_lower = request.message_text.lower()
            patient_first_name = (current_user.full_name or "Patient").split()[0]
            doc_raw_name = appt.doctor.user.full_name if (appt.doctor and appt.doctor.user and appt.doctor.user.full_name) else "Doctor"
            doc_clean_name = doc_raw_name if doc_raw_name.startswith("Dr.") else f"Dr. {doc_raw_name}"

            if any(w in msg_text_lower for w in ["x-ray", "xray", "report", "file", "document", "pdf"]):
                reply_text = f"Hello {patient_first_name}! Thank you for notifying us. {doc_clean_name} has received your diagnostic report update and will review it prior to your consultation session."
            elif any(w in msg_text_lower for w in ["hi", "hii", "hello", "hey", "greetings"]):
                reply_text = f"Hello {patient_first_name}! Welcome to Clinic Support. How can we assist you with your upcoming consultation with {doc_clean_name}?"
            elif any(w in msg_text_lower for w in ["pain", "emergency", "severe", "bleeding", "swelling"]):
                reply_text = f"Notice: We have flagged your symptoms for urgent review. If this is an acute dental emergency, please visit the nearest clinic emergency desk or call our helpline."
            elif any(w in msg_text_lower for w in ["time", "timing", "late", "reschedule", "delay"]):
                reply_text = f"Hello {patient_first_name}! Your time request has been forwarded to the clinic desk. You can also reschedule directly from the Appointments section."
            else:
                reply_text = f"Hello {patient_first_name}! Your message has been logged for {doc_clean_name} and the clinic desk. We will assist you promptly during your consultation."

            auto_reply_msg = ChatMessage(
                appointment_id=request.appointment_id,
                sender_id=receiver_id,
                receiver_id=current_user.id,
                message_text=reply_text,
                is_read=False,
            )
            db.add(auto_reply_msg)
            await db.commit()

    except Exception as err:
        await db.rollback()
        logger.error(f"Error persisting chat message or auto-reply: {err}")
        raise BadRequestError("Could not process chat message. Please try again.") from err

    # 4. Prepare clean output model
    msg_out = ChatMessageOut(
        id=new_msg.id,
        appointment_id=new_msg.appointment_id,
        sender_id=new_msg.sender_id,
        sender_name=current_user.full_name or "User",
        sender_role=current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
        receiver_id=new_msg.receiver_id,
        message_text=new_msg.message_text,
        is_read=new_msg.is_read,
        created_at=new_msg.created_at,
    )

    return ApiResponse.success(
        data=msg_out.model_dump(mode="json"),
        message="Message sent successfully.",
        status_code=status.HTTP_201_CREATED,
    )


# ── 2. GET /chat/history/{appointment_id} ──────────────────────────────────────
@router.get(
    "/history/{appointment_id}",
    summary="Get chat history for an appointment",
)
async def get_chat_history(
    appointment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Retrieve all chat messages for an appointment in chronological order."""
    # 1. Fetch appointment to verify participation
    stmt = (
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .options(
            selectinload(Appointment.patient),
            selectinload(Appointment.doctor),
        )
    )
    res = await db.execute(stmt)
    appt = res.scalar_one_or_none()
    if not appt:
        raise NotFoundError("Appointment not found.")

    patient_user_id = appt.patient.user_id if appt.patient else None
    doctor_user_id = appt.doctor.user_id if appt.doctor else None

    if current_user.id not in (patient_user_id, doctor_user_id) and current_user.role not in ("admin", "receptionist"):
        raise PermissionDeniedError("You cannot view messages for this appointment.")

    # 2. Fetch messages
    msg_stmt = (
        select(ChatMessage)
        .where(ChatMessage.appointment_id == appointment_id)
        .options(selectinload(ChatMessage.sender))
        .order_by(ChatMessage.created_at.asc())
    )
    msg_res = await db.execute(msg_stmt)
    messages = msg_res.scalars().all()

    # 3. Mark unread messages sent to current_user as read
    unread_ids = [m.id for m in messages if m.receiver_id == current_user.id and not m.is_read]
    if unread_ids:
        await db.execute(
            update(ChatMessage)
            .where(ChatMessage.id.in_(unread_ids))
            .values(is_read=True)
        )
        await db.commit()

    output_items = []
    for m in messages:
        sender_name = m.sender.full_name if m.sender else "User"
        sender_role = (m.sender.role.value if hasattr(m.sender.role, 'value') else str(m.sender.role)) if m.sender else "user"
        output_items.append(
            ChatMessageOut(
                id=m.id,
                appointment_id=m.appointment_id,
                sender_id=m.sender_id,
                sender_name=sender_name,
                sender_role=sender_role,
                receiver_id=m.receiver_id,
                message_text=m.message_text,
                is_read=m.is_read or (m.id in unread_ids),
                created_at=m.created_at,
            ).model_dump(mode="json")
        )

    return ApiResponse.success(
        data=output_items,
        message="Chat history retrieved successfully.",
    )
