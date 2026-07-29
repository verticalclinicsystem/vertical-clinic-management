import logging
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.models.appointment import Appointment
from app.models.teleconsult import TeleConsultation
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class TeleConsultService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.notification_service = NotificationService(db)

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
        room_name = f"VerticalClinic_Teleconsult_{appointment_id.hex[:12]}"
        meeting_url = room_name

        start_time = appointment.appointment_datetime
        # Assume 30 min duration
        end_time = start_time + timedelta(minutes=30)
        # Configured expiry time: 1 hour after the scheduled end time
        expiry_time = end_time + timedelta(hours=1)

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
        
        # Send notifications (Step 11)
        message = (
            f"Your teleconsultation with {appointment.doctor.user.full_name} is scheduled on "
            f"{appointment.appointment_datetime.strftime('%Y-%m-%d at %I:%M %p')}. "
            f"Here is your meeting link: {meeting_url}. The join button will be active 10 minutes before."
        )
        await self.notification_service.send_multichannel_notification(
            user_id=appointment.patient.user_id,
            title="Meeting Link Ready",
            message=message,
            type="meeting_ready"
        )

        await self.db.commit()
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

        if appointment.status != "confirmed":
            raise BadRequestError("Appointment is not confirmed.")

        tele = appointment.teleconsultation
        if not tele:
            from app.models.user import User
            from app.core.rbac import UserRole
            user_stmt = select(User).where(User.id == user_id)
            user_res = await self.db.execute(user_stmt)
            user_obj = user_res.scalar_one_or_none()
            if user_obj and user_obj.role in (UserRole.DOCTOR, UserRole.ADMIN):
                tele = await self.generate_meeting_link(appointment_id)
            else:
                raise BadRequestError("Meeting URL has not been generated yet.")

        if tele.status == "Closed":
            raise BadRequestError("This meeting has already closed.")

        # Validate allowed joining window (e.g., from 10 mins before start until expiry)
        now = datetime.now(timezone.utc)
        
        # Ensure times are timezone-aware
        appt_start = appointment.appointment_datetime
        if appt_start.tzinfo is None:
            appt_start = appt_start.replace(tzinfo=timezone.utc)
            
        tele_expiry = tele.expiry_time
        if tele_expiry.tzinfo is None:
            tele_expiry = tele_expiry.replace(tzinfo=timezone.utc)

        allowed_start = appt_start - timedelta(minutes=10)

        if now < allowed_start:
          delta = allowed_start - now
          mins = int(delta.total_seconds() / 60)
          raise BadRequestError(f"You can only join the meeting starting 10 minutes before. Please wait {mins} more minutes.")

        if now > tele_expiry:
            raise BadRequestError("The meeting link has expired.")

        # Update meeting status to Active if it was Ready
        if tele.status == "Ready":
            tele.status = "Active"
            await self.db.commit()

        return {
            "appointment_id": str(appointment.id),
            "meeting_url": tele.meeting_url,
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
        logger.info(f"Closed meeting & marked appointment {appointment_id} as completed.")
