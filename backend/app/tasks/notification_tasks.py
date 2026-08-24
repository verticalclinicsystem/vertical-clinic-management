"""
notification_tasks — handles periodic appointment reminders and teleconsultation meeting generation.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, joinedload
from twilio.rest import Client

from app.config import settings
from app.models.appointment import Appointment
from app.models.teleconsult import TeleConsultation
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.user import User
from app.tasks.celery_app import celery_app
from app.utils.email import send_email

logger = logging.getLogger(__name__)

from sqlalchemy.pool import NullPool

# Synchronous engine for sync Celery worker
_engine = create_engine(settings.SYNC_DATABASE_URL, poolclass=NullPool)


def _send_sync_notification(
    session: Session,
    user_id: uuid.UUID,
    title: str,
    message: str,
    noti_type: str = "general",
    attachments: list[tuple[str, bytes, str]] | None = None,
) -> None:
    """Helper to dispatch multi-channel alerts synchronously inside a Celery task."""
    user = session.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()
    if not user:
        logger.warning(f"User {user_id} not found for sync notification")
        return

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

    # 1. In-App Notification (Always write to DB so it populates the bell dropdown history)
    noti = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=noti_type,
        is_read=False
    )
    session.add(noti)
    logger.info(f"[Sync In-App] Created database notification record for user {user_id}: {title}")

    # 2. Email
    if email_enabled and user.email:
        if noti_type in ["patient_joined", "doctor_joined", "check_in", "reminder_10m", "reminder_1h"]:
            logger.info(f"[Sync Email Skip] Skipped email to {user.email} for realtime alert type: {noti_type}")
        else:
            logger.info(f"[Sync Email] Sending to {user.email}: {title}")
            try:
                html_body = f"<h3>{title}</h3><p>{message}</p><br/><hr/><p style='font-size: 11px; color: #888;'>This is an automated notification from Vertical Clinic.</p>"
                asyncio.run(send_email(
                    to=user.email,
                    subject=title,
                    html_body=html_body,
                    plain_body=message,
                    attachments=attachments
                ))
            except Exception as email_err:
                logger.error(f"[Sync Email Error] Failed to send email to {user.email}: {email_err}")

    # 3. SMS
    if sms_enabled and user.phone:
        logger.info(f"[Sync SMS] Sending to {user.phone}: {message}")
        if settings.SMS_PROVIDER == "twilio" and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            is_dummy = (
                "dummy" in settings.TWILIO_ACCOUNT_SID.lower()
                or "your_" in settings.TWILIO_ACCOUNT_SID.lower()
                or not settings.TWILIO_ACCOUNT_SID
            )
            if not is_dummy:
                try:
                    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                    to_phone = user.phone
                    if not to_phone.startswith("+"):
                        to_phone = f"+91{to_phone}" if len(to_phone) == 10 else f"+{to_phone}"
                    
                    client.messages.create(
                        body=f"{title}: {message}",
                        from_=settings.TWILIO_FROM_NUMBER,
                        to=to_phone
                    )
                    logger.info(f"[Twilio SMS Sync Success] SMS sent to {to_phone}")
                except Exception as twilio_err:
                    logger.error(f"[Twilio SMS Sync Error] Failed to send SMS: {twilio_err}")
            else:
                logger.info("[Twilio SMS Sync Dev] Dummy account SID detected. Skipping API request.")
        else:
            logger.info(f"[Sync SMS Log Only] SMS provider not twilio or missing credentials: {message}")

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
                    joinedload(Appointment.doctor).joinedload(Doctor.user),
                    joinedload(Appointment.branch),
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

                # ── A.5. 2 Hours Before Reminder ──────────────────────────────────
                elif 110 <= delta_minutes <= 130 and not appt.reminder_sent_2h:
                    doc_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else 'Doctor'
                    branch_name = appt.branch.name if appt.branch else 'Vertical Clinic'
                    time_str = appt_dt.strftime('%I:%M %p')
                    msg = (
                        f"Reminder: Your appointment with Dr. {doc_name} is in 2 hours "
                        f"({time_str}) at {branch_name}. Type: {appt.treatment_type}."
                    )
                    _send_sync_notification(session, appt.patient.user_id, "Appointment Reminder (2h)", msg, "reminder_2h")
                    appt.reminder_sent_2h = True
                    processed_count += 1

                # ── B. 30 Minutes Before: Generate Meeting URL + Reminder ───────────────
                elif 20 <= delta_minutes <= 40 and not appt.reminder_sent_1h:
                    meeting_url = None
                    if appt.consultation_type == "teleconsultation":
                        # Generate meeting if not exists
                        tele = appt.teleconsultation
                        if not tele:
                            room_name = f"vclinicteleconsult{appt.id.hex[:12]}"
                            meeting_url = room_name

                            start_time = appt_dt
                            end_time = start_time + timedelta(minutes=30)
                            expiry_time = end_time + timedelta(hours=24)

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

                        clean_room = meeting_url.lower().replace("_", "").replace("-", "")
                        full_link = f"https://meet.element.io/{clean_room}"
                        msg = (
                            f"Your video consultation starts in 30 minutes. "
                            f"Here is your meeting URL: {full_link}. "
                            f"The 'Join Meeting' button will activate in your portal 10 mins before."
                        )
                        # Send to doctor as well
                        if appt.doctor and appt.doctor.user_id:
                            pat_name = appt.patient.user.full_name if appt.patient and appt.patient.user else 'Patient'
                            doc_msg = (
                                f"Reminder: Your video consultation with patient {pat_name} "
                                f"starts in 30 minutes. Meeting URL: {full_link}."
                            )
                            _send_sync_notification(session, appt.doctor.user_id, "Upcoming Teleconsultation (30m)", doc_msg, "reminder_1h")
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
                        room_name = appt.teleconsultation.meeting_url if appt.teleconsultation else f"vclinicteleconsult{appt.id.hex[:12]}"
                        clean_room = room_name.lower().replace("_", "").replace("-", "")
                        meeting_url = f"https://meet.element.io/{clean_room}"
                        msg = (
                            f"Urgent: Your video consultation starts in 10 minutes. "
                            f"Join here: {meeting_url}."
                        )
                        # Send to doctor as well
                        if appt.doctor and appt.doctor.user_id:
                            pat_name = appt.patient.user.full_name if appt.patient and appt.patient.user else 'Patient'
                            doc_msg = (
                                f"Urgent: Your video consultation with patient {pat_name} "
                                f"starts in 10 minutes. Join here: {meeting_url}."
                            )
                            _send_sync_notification(session, appt.doctor.user_id, "Upcoming Teleconsultation (10m)", doc_msg, "reminder_10m")
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


@celery_app.task(name="app.tasks.notification_tasks.auto_expire_stale_appointments")
def auto_expire_stale_appointments() -> dict:
    """
    Auto-expires unresolved past appointments by marking them as 'no_show'.
    Runs periodically.
    """
    now = datetime.now(timezone.utc)
    updated_count = 0

    try:
        with Session(_engine) as session:
            # Query appointments where:
            # - status is in ["pending", "confirmed", "checked_in", "in_consultation"]
            # - scheduled time is older than 4 hours from now
            stmt = (
                select(Appointment)
                .where(
                    Appointment.status.in_(["pending", "confirmed", "checked_in", "in_consultation"]),
                    Appointment.appointment_datetime < now - timedelta(hours=4)
                )
            )
            stale_appointments = session.execute(stmt).scalars().all()

            for appt in stale_appointments:
                # For teleconsultations, close any active meeting first
                if appt.consultation_type == "teleconsultation":
                    tele = appt.teleconsultation
                    if tele:
                        tele.status = "Closed"
                
                appt.status = "no_show"
                updated_count += 1
                
                # Send a notification to the patient about the missed appointment
                try:
                    msg = (
                        f"Your scheduled appointment for {appt.treatment_type} on "
                        f"{appt.appointment_datetime.strftime('%Y-%m-%d %H:%M')} was marked as no-show."
                    )
                    _send_sync_notification(
                        session=session,
                        user_id=appt.patient.user_id,
                        title="Appointment Missed (No-Show)",
                        message=msg,
                        noti_type="general"
                    )
                except Exception as noti_err:
                    logger.warning("Failed to send no-show notification for appt %s: %s", appt.id, noti_err)

            session.commit()

        logger.info("Auto-expire stale appointments: updated %d appointments to no_show", updated_count)
        return {"updated": updated_count, "ran_at": now.isoformat()}

    except Exception as exc:
        logger.error("Auto-expire stale appointments task failed: %s", exc)
        return {"error": str(exc)}

