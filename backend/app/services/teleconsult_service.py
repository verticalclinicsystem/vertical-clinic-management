import logging
import uuid
import datetime
from datetime import timezone, timedelta
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, PermissionDeniedError
from app.core.rbac import UserRole
from app.core.websocket import manager as ws_manager
from app.models.appointment import Appointment
from app.models.teleconsult import TeleConsultation
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.user import User
from app.repositories.teleconsult_repo import TeleConsultRepository
from app.services.notification_service import NotificationService
from app.services.patient_service import PatientService

logger = logging.getLogger(__name__)


class TeleConsultService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = TeleConsultRepository(db)
        self.notification_service = NotificationService(db)
        self.patient_service = PatientService(db)

    async def generate_meeting_link(self, appointment_id: uuid.UUID) -> TeleConsultation:
        """
        Step 10: Generate a unique meeting URL exactly 1 hour before scheduled time.
        """
        # Fetch appointment with relations
        stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.doctor).selectinload(Doctor.user),
                selectinload(Appointment.teleconsultation)
            )
            .where(Appointment.id == appointment_id)
        )
        res = await self.db.execute(stmt)
        appointment = res.scalar_one_or_none()

        if not appointment:
            raise BadRequestError("Appointment not found.")

        if appointment.consultation_type != "teleconsultation":
            raise BadRequestError("This is not a teleconsultation appointment.")

        if appointment.teleconsultation:
            return appointment.teleconsultation

        # Generate a unique video meeting room identifier for Jitsi Meet in-app calls
        room_name = f"vclinicteleconsult{appointment_id.hex[:12]}"
        meeting_url = room_name

        start_time = appointment.appointment_datetime
        # Assume 30 min duration
        end_time = start_time + timedelta(minutes=30)
        # Configured expiry time: 24 hours to support flexible teleconsultation testing
        expiry_time = end_time + timedelta(hours=24)

        tele_consult = TeleConsultation(
            appointment_id=appointment.id,
            meeting_url=meeting_url,
            start_time=start_time,
            end_time=end_time,
            expiry_time=expiry_time,
            status="Ready",
            meeting_link_sent=True
        )

        self.db.add(tele_consult)
        await self.db.commit()
        await self.db.refresh(tele_consult)
        
        # Send notifications
        try:
            message = (
                f"Your teleconsultation with Dr. {appointment.doctor.user.full_name} is scheduled. "
                f"Here is your meeting room: {meeting_url}."
            )
            await self.notification_service.send_multichannel_notification(
                user_id=appointment.patient.user_id,
                title="Meeting Link Ready",
                message=message,
                type="meeting_ready"
            )
        except Exception as e:
            logger.warning(f"Failed sending notification: {e}")

        logger.info(f"Generated meeting link for appointment {appointment.id}: {meeting_url}")
        return tele_consult

    async def validate_and_join_meeting(self, appointment_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        """
        Step 13: Validate joining criteria at scheduled time.
        """
        stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.doctor).selectinload(Doctor.user),
                selectinload(Appointment.teleconsultation)
            )
            .where(Appointment.id == appointment_id)
        )
        res = await self.db.execute(stmt)
        appointment = res.scalar_one_or_none()

        if not appointment:
            raise BadRequestError("Appointment not found.")

        if appointment.status in ("cancelled", "completed", "no_show"):
            raise BadRequestError(f"Appointment is {appointment.status}.")

        tele = appointment.teleconsultation
        if not tele:
            tele = await self.generate_meeting_link(appointment_id)

        if tele.status == "Closed":
            raise BadRequestError("This meeting has already closed.")

        # Validate allowed joining window (e.g., from 10 mins before start until expiry)
        now = datetime.datetime.now(timezone.utc)
        
        # Ensure times are timezone-aware
        appt_start = appointment.appointment_datetime
        if appt_start.tzinfo is None:
            appt_start = appt_start.replace(tzinfo=timezone.utc)
            
        tele_expiry = tele.expiry_time
        if tele_expiry.tzinfo is None:
            tele_expiry = tele_expiry.replace(tzinfo=timezone.utc)

        allowed_start = appt_start - timedelta(minutes=10)

        # Bypass early restriction if user is doctor or meeting is already active/calling or status is in_consultation
        is_doctor = (user_id == appointment.doctor.user_id) if (appointment.doctor and appointment.doctor.user_id) else False
        is_meeting_initiated = (tele.status in ("Active", "calling") or appointment.status == "in_consultation")

        if now < allowed_start and not is_doctor and not is_meeting_initiated:
          delta = allowed_start - now
          mins = int(delta.total_seconds() / 60)
          raise BadRequestError(f"You can only join the meeting starting 10 minutes before. Please wait {mins} more minutes.")

        if now > tele_expiry:
            raise BadRequestError("The meeting link has expired.")

        # Update meeting status to Active if it was Ready
        if tele.status == "Ready":
            tele.status = "Active"
            await self.db.commit()

        # Send notification to the other participant
        try:
            if user_id == appointment.patient.user_id:
                if appointment.doctor and appointment.doctor.user_id:
                    await self.notification_service.send_multichannel_notification(
                        user_id=appointment.doctor.user_id,
                        title="📹 Patient Waiting in Call",
                        message=f"Patient {appointment.patient.user.full_name} has entered the video room. Click to join.",
                        type="patient_joined"
                    )
            elif appointment.doctor and user_id == appointment.doctor.user_id:
                if appointment.patient and appointment.patient.user_id:
                    clean_room = (tele.meeting_url or f"vclinicteleconsult{appointment.id.hex[:12]}").lower().replace("_", "").replace("-", "")
                    direct_url = f"https://meet.element.io/{clean_room}"
                    msg = f"Dr. {appointment.doctor.user.full_name} is waiting in your video call room. Click here to join call immediately: {direct_url}"
                    await self.notification_service.send_multichannel_notification(
                        user_id=appointment.patient.user_id,
                        title="👨‍⚕️ Doctor Joined Call",
                        message=msg,
                        type="doctor_joined"
                    )
        except Exception as e:
            logger.warning(f"Failed to dispatch join notifications: {e}")

        clean_room = (tele.meeting_url or f"vclinicteleconsult{appointment.id.hex[:12]}").lower().replace("_", "").replace("-", "")
        return {
            "appointment_id": str(appointment.id),
            "meeting_url": clean_room,
            "status": tele.status,
            "doctor_name": appointment.doctor.user.full_name,
            "patient_name": appointment.patient.user.full_name,
        }

    async def end_meeting(self, appointment_id: uuid.UUID) -> None:
        """
        Step 15: Close the meeting, mark appointment as completed.
        """
        stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.doctor).selectinload(Doctor.user),
                selectinload(Appointment.teleconsultation)
            )
            .where(Appointment.id == appointment_id)
        )
        res = await self.db.execute(stmt)
        appointment = res.scalar_one_or_none()

        if not appointment:
            raise BadRequestError("Appointment not found.")

        tele = appointment.teleconsultation
        if tele:
            tele.status = "Closed"

        appointment.status = "completed"
        
        # Send final notification (Step 17)
        message = (
            f"Your consultation with {appointment.doctor.user.full_name} has been completed. "
            f"Prescription, clinical summary, and report recommendations are now available in your portal."
        )
        await self.notification_service.send_multichannel_notification(
            user_id=appointment.patient.user_id,
            title="Consultation Completed",
            message=message,
            type="completed"
        )
        await self.db.commit()

        # Broadcast queue update
        try:
            await ws_manager.send_to_branch(str(appointment.branch_id), {"event": "queue_updated", "branch_id": str(appointment.branch_id)})
        except Exception as ws_err:
            logger.warning(f"Failed to broadcast websocket event: {ws_err}")

        logger.info(f"Closed meeting & marked appointment {appointment_id} as completed.")

    async def get_active_teleconsultation(self, user_id: uuid.UUID) -> dict | None:
        """Get active or next upcoming video/teleconsultation for a patient."""
        patient = await self.patient_service.get_patient_by_user_id(user_id)
        if not patient:
            return None

        now = datetime.datetime.now(timezone.utc)
        stmt = (
            select(Appointment)
            .where(
                Appointment.patient_id == patient.id,
                Appointment.consultation_type == "teleconsultation",
                Appointment.status.in_(["pending", "confirmed", "checked_in", "in_consultation"])
            )
            .options(
                selectinload(Appointment.doctor).selectinload(Doctor.user),
                selectinload(Appointment.teleconsultation)
            )
            .order_by(Appointment.appointment_datetime.asc())
        )
        res = await self.db.execute(stmt)
        appts = res.scalars().all()

        appt = None
        for a in appts:
            appt_dt = a.appointment_datetime
            if appt_dt.tzinfo is None:
                appt_dt = appt_dt.replace(tzinfo=timezone.utc)
            if appt_dt >= now - datetime.timedelta(hours=2):
                appt = a
                break

        if not appt:
            return None

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
            try:
                tele_consult = await self.generate_meeting_link(appt.id)
                appt.teleconsultation = tele_consult
            except Exception as e:
                logger.error(f"Error auto-generating meeting link in active endpoint: {e}")

        meeting_link = appt.teleconsultation.meeting_url if appt.teleconsultation else None
        meeting_status = appt.teleconsultation.status if appt.teleconsultation else "Not Generated"

        can_join = False
        is_expired = False
        is_ongoing = False

        allowed_start = appt_dt - datetime.timedelta(minutes=10)
        allowed_end = appt_dt + datetime.timedelta(minutes=30)

        if appt.status in ("confirmed", "pending", "checked_in", "in_consultation"):
            if meeting_link or (allowed_start <= now <= allowed_end):
                can_join = True
                if now >= appt_dt or appt.status == "in_consultation":
                    is_ongoing = True
            elif now > allowed_end and appt.status not in ("checked_in", "in_consultation"):
                is_expired = True

        return {
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

    async def get_past_teleconsultations(self, user_id: uuid.UUID) -> list[dict]:
        """Fetch past completed teleconsultations for a patient."""
        patient = await self.patient_service.get_patient_by_user_id(user_id)
        if not patient:
            return []

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
        res = await self.db.execute(stmt)
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
        return past_records

    async def signal_teleconsultation_call(self, appointment_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        """Trigger call signal for teleconsultation room and set status to 'calling'."""
        join_info = await self.validate_and_join_meeting(appointment_id, user_id)
        
        stmt = select(Appointment).options(selectinload(Appointment.teleconsultation)).where(Appointment.id == appointment_id)
        res = await self.db.execute(stmt)
        appt = res.scalar_one_or_none()
        if appt and appt.teleconsultation:
            appt.teleconsultation.status = "calling"
            appt.teleconsultation.updated_at = datetime.datetime.now(timezone.utc)
            await self.db.commit()

        return join_info

    async def check_incoming_call(self, user: User) -> dict:
        """Check if there is an active incoming call signal for the user."""
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

        if user.role == UserRole.PATIENT:
            stmt = stmt.join(Patient, Appointment.patient_id == Patient.id).where(Patient.user_id == user.id)
        elif user.role == UserRole.DOCTOR:
            stmt = stmt.join(Doctor, Appointment.doctor_id == Doctor.id).where(Doctor.user_id == user.id)
        else:
            return {"has_incoming_call": False}

        res = await self.db.execute(stmt)
        appts = res.scalars().all()

        if not appts:
            return {"has_incoming_call": False}

        active_appt = appts[0]
        tele = active_appt.teleconsultation
        clean_room = (tele.meeting_url or f"vclinicteleconsult{active_appt.id.hex[:12]}").lower().replace("_", "").replace("-", "")

        caller_name = active_appt.patient.user.full_name if user.role == UserRole.DOCTOR else active_appt.doctor.user.full_name
        caller_role = "patient" if user.role == UserRole.DOCTOR else "doctor"

        return {
            "has_incoming_call": True,
            "appointment_id": str(active_appt.id),
            "room_name": clean_room,
            "status": tele.status,
            "caller_name": caller_name,
            "caller_role": caller_role,
            "doctor_name": active_appt.doctor.user.full_name if active_appt.doctor and active_appt.doctor.user else "Doctor",
            "patient_name": active_appt.patient.user.full_name if active_appt.patient and active_appt.patient.user else "Patient",
        }

    async def accept_call(self, appointment_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        """Accept incoming call and set status to Active."""
        join_info = await self.validate_and_join_meeting(appointment_id, user_id)
        
        stmt = select(Appointment).options(selectinload(Appointment.teleconsultation)).where(Appointment.id == appointment_id)
        res = await self.db.execute(stmt)
        appt = res.scalar_one_or_none()
        if appt and appt.teleconsultation:
            appt.teleconsultation.status = "Active"
            appt.teleconsultation.updated_at = datetime.datetime.now(timezone.utc)
            await self.db.commit()

        return join_info

    async def decline_call(self, appointment_id: uuid.UUID) -> None:
        """Decline incoming call signal, reset status to Ready."""
        stmt = select(Appointment).options(selectinload(Appointment.teleconsultation)).where(Appointment.id == appointment_id)
        res = await self.db.execute(stmt)
        appt = res.scalar_one_or_none()
        if appt and appt.teleconsultation:
            appt.teleconsultation.status = "Ready"
            await self.db.commit()

    async def patient_ready_in_lobby(self, appointment_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Notify doctor patient is ready in lobby."""
        stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.doctor).selectinload(Doctor.user),
                selectinload(Appointment.teleconsultation)
            )
            .where(Appointment.id == appointment_id)
        )
        res = await self.db.execute(stmt)
        appt = res.scalar_one_or_none()
        if not appt:
            raise BadRequestError("Appointment not found")
            
        if user_id != appt.patient.user_id:
            raise PermissionDeniedError("You are not authorized for this appointment.")

        if appt.teleconsultation:
            appt.teleconsultation.status = "patient_ready"
            appt.teleconsultation.updated_at = datetime.datetime.now(timezone.utc)
            await self.db.commit()

        # Broadcast to the doctor via WebSocket
        if appt.doctor and appt.doctor.user_id:
            try:
                await ws_manager.send_to_user(
                    str(appt.doctor.user_id),
                    {
                        "event": "patient_ready",
                        "appointment_id": str(appointment_id),
                        "patient_name": appt.patient.user.full_name,
                        "message": f"{appt.patient.user.full_name} is now ready in the waiting lobby."
                    }
                )
                await ws_manager.send_to_branch(str(appt.branch_id), {"event": "queue_updated", "branch_id": str(appt.branch_id)})
            except Exception:
                pass

    async def patient_left_lobby(self, appointment_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Notify doctor patient left lobby."""
        stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.doctor).selectinload(Doctor.user),
                selectinload(Appointment.teleconsultation)
            )
            .where(Appointment.id == appointment_id)
        )
        res = await self.db.execute(stmt)
        appt = res.scalar_one_or_none()
        if not appt:
            raise BadRequestError("Appointment not found")
            
        if user_id != appt.patient.user_id:
            raise PermissionDeniedError("You are not authorized for this appointment.")

        if appt.teleconsultation and appt.teleconsultation.status == "patient_ready":
            appt.teleconsultation.status = "Ready"
            appt.teleconsultation.updated_at = datetime.datetime.now(timezone.utc)
            await self.db.commit()

        # Broadcast to the doctor via WebSocket
        if appt.doctor and appt.doctor.user_id:
            try:
                await ws_manager.send_to_user(
                    str(appt.doctor.user_id),
                    {
                        "event": "patient_left",
                        "appointment_id": str(appointment_id),
                        "patient_name": appt.patient.user.full_name,
                        "message": f"{appt.patient.user.full_name} has left the waiting lobby."
                    }
                )
                await ws_manager.send_to_branch(str(appt.branch_id), {"event": "queue_updated", "branch_id": str(appt.branch_id)})
            except Exception:
                pass

    async def create_meeting_link_instantly(self, appointment_id: uuid.UUID, doctor_name: str) -> dict:
        """Instantly generate meeting link and notify patient via WebSocket."""
        tele_consult = await self.generate_meeting_link(appointment_id)

        stmt = select(Appointment).options(selectinload(Appointment.patient)).where(Appointment.id == appointment_id)
        res = await self.db.execute(stmt)
        appt = res.scalar_one_or_none()
        if appt and appt.patient:
            try:
                await ws_manager.send_to_branch(str(appt.branch_id), {"event": "queue_updated", "branch_id": str(appt.branch_id)})
                await ws_manager.send_to_user(str(appt.patient.user_id), {
                    "event": "doctor_ready",
                    "appointment_id": str(appt.id),
                    "doctor_name": doctor_name,
                    "meeting_url": tele_consult.meeting_url
                })
            except Exception as ws_err:
                logger.warning(f"Failed to broadcast websocket event: {ws_err}")

        return {
            "meeting_url": tele_consult.meeting_url,
            "status": tele_consult.status
        }

