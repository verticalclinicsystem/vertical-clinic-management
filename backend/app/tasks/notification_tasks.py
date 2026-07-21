"""
notification_tasks — handles periodic appointment reminders and teleconsultation meeting generation.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models.appointment import Appointment
from app.models.teleconsult import TeleConsultation
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# Synchronous engine for sync Celery worker
_engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)


def _send_sync_notification(
    session: Session,
    user_id: uuid.UUID,
    title: str,
    message: str,
    noti_type: str = "general"
) -> None:
    """Helper to dispatch multi-channel alerts synchronously inside a Celery task."""
    # Check preferences
    patient = session.execute(
        select(Patient).where(Patient.user_id == user_id)
    ).scalar_one_or_none()

    email_enabled = True
    sms_enabled = True
    whatsapp_enabled = False
    push_enabled = True

    if patient:
        email_enabled = patient.notification_email
        sms_enabled = patient.notification_sms
        whatsapp_enabled = patient.notification_whatsapp
        push_enabled = patient.notification_push

    # 1. In-App Notification
    if push_enabled:
        noti = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=noti_type,
            is_read=False
        )
        session.add(noti)
        logger.info(f"[Sync In-App] Created notification for user {user_id}: {title}")

    # 2. Email
    if email_enabled:
        logger.info(f"[Sync Email] To {user_id}: {title} | {message}")

    # 3. SMS
    if sms_enabled:
        logger.info(f"[Sync SMS] To {user_id}: {message}")

    # 4. WhatsApp
    if whatsapp_enabled:
        logger.info(f"[Sync WhatsApp] To {user_id}: {message}")


@celery_app.task(name="app.tasks.notification_tasks.send_appointment_reminders")
def send_appointment_reminders() -> dict:
    """
    Periodic task running every minute to:
    1. Send 24h, 1h, 10m reminders.
    2. Generate teleconsultation meeting link 1h before.
    3. Auto-complete appointments and close meetings after expiry time.
    """
    now = datetime.now(timezone.utc)
    processed_count = 0
    generated_meetings = 0
    expired_count = 0

    try:
        with Session(_engine) as session:
            # Query confirmed appointments in the future or active
            stmt = (
                select(Appointment)
                .options(
                    joinedload(Appointment.patient).joinedload(Patient.user),
                    joinedload(Appointment.doctor).joinedload(Doctor.user), # just load doctor user as well if needed
                    joinedload(Appointment.teleconsultation)
                )
                .where(Appointment.status == "confirmed")
            )
            appointments = session.execute(stmt).unique().scalars().all()

            for appt in appointments:
                appt_dt = appt.appointment_datetime
                if appt_dt.tzinfo is None:
                    appt_dt = appt_dt.replace(tzinfo=timezone.utc)

                delta = appt_dt - now
                delta_minutes = delta.total_seconds() / 60.0

                # ── A. 24 Hours Before Reminder ───────────────────────────────────
                if 1410 <= delta_minutes <= 1470 and not appt.reminder_sent_24h:
                    msg = (
                        f"Reminder: You have an appointment scheduled tomorrow at "
                        f"{appt_dt.strftime('%I:%M %p')}. "
                        f"Type: {appt.treatment_type} ({appt.consultation_type})."
                    )
                    _send_sync_notification(session, appt.patient.user_id, "Appointment Reminder (24h)", msg, "reminder_24h")
                    appt.reminder_sent_24h = True
                    processed_count += 1

                # ── B. 30 Minutes Before: Generate Meeting URL + Reminder ───────────────
                elif 20 <= delta_minutes <= 40 and not appt.reminder_sent_1h:
                    meeting_url = None
                    if appt.consultation_type == "teleconsultation":
                        # Generate meeting if not exists
                        tele = appt.teleconsultation
                        if not tele:
                            meeting_id = uuid.uuid4()
                            meet_code = f"{meeting_id.hex[:3]}-{meeting_id.hex[3:7]}-{meeting_id.hex[7:10]}"
                            meeting_url = f"https://meet.google.com/{meet_code}"

                            start_time = appt_dt
                            end_time = start_time + timedelta(minutes=30)
                            expiry_time = end_time + timedelta(hours=1)  # Expiry buffer

                            tele = TeleConsultation(
                                appointment_id=appt.id,
                                meeting_url=meeting_url,
                                start_time=start_time,
                                end_time=end_time,
                                expiry_time=expiry_time,
                                status="Ready",
                                meeting_link_sent=True
                            )
                            session.add(tele)
                            generated_meetings += 1
                        else:
                            meeting_url = tele.meeting_url

                        msg = (
                            f"Your video consultation starts in 30 minutes. "
                            f"Here is your meeting URL: {meeting_url}. "
                            f"The 'Join Meeting' button will activate in your portal 10 mins before."
                        )
                    else:
                        msg = (
                            f"Reminder: Your appointment at clinic starts in 30 minutes ("
                            f"{appt_dt.strftime('%I:%M %p')}). See you soon!"
                        )

                    _send_sync_notification(session, appt.patient.user_id, "Appointment Reminder (30m)", msg, "reminder_1h")
                    appt.reminder_sent_1h = True
                    processed_count += 1

                # ── C. 10 Minutes Before Reminder ────────────────────────────────
                elif 5 <= delta_minutes <= 15 and not appt.reminder_sent_10m:
                    if appt.consultation_type == "teleconsultation":
                        meeting_url = appt.teleconsultation.meeting_url if appt.teleconsultation else "https://meet.google.com/abc-defg-hij"
                        msg = (
                            f"Urgent: Your video consultation starts in 10 minutes. "
                            f"Join here: {meeting_url}."
                        )
                    else:
                        msg = f"Reminder: Your appointment starts in 10 minutes."

                    _send_sync_notification(session, appt.patient.user_id, "Final Appointment Reminder (10m)", msg, "reminder_10m")
                    appt.reminder_sent_10m = True
                    processed_count += 1

                # ── D. Expiry / Auto-Complete Consultation (past scheduled time + expiry buffer) ──
                elif delta_minutes < -90:  # 90 minutes past scheduled start time (exceeds duration + expiry buffer)
                    if appt.consultation_type == "teleconsultation":
                        tele = appt.teleconsultation
                        if tele:
                            tele.status = "Closed"
                    
                    appt.status = "completed"
                    
                    msg = (
                        f"Your consultation has been completed. "
                        f"Prescription, clinical summary, and report recommendations are now available in your portal."
                    )
                    _send_sync_notification(session, appt.patient.user_id, "Consultation Completed", msg, "completed")
                    expired_count += 1

            session.commit()

        logger.info(
            "Appointment reminders processed: %d sent, %d meetings generated, %d auto-completed",
            processed_count,
            generated_meetings,
            expired_count
        )
        return {
            "processed": processed_count,
            "generated_meetings": generated_meetings,
            "auto_completed": expired_count,
            "ran_at": now.isoformat()
        }

    except Exception as exc:
        logger.error("Appointment reminders task failed: %s", exc)
        return {"error": str(exc)}
