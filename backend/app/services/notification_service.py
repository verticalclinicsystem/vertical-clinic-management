import logging
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.user import User
from app.repositories.notification_repo import NotificationRepository

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = NotificationRepository(db)

    async def get_user_notifications(self, user_id: uuid.UUID) -> list[Notification]:
        """List notifications belonging to a user."""
        return await self.repo.get_by_user_id(user_id)

    async def mark_all_read(self, user_id: uuid.UUID) -> None:
        """Mark all unread notifications of the user as read."""
        await self.repo.mark_all_as_read(user_id)
        await self.db.commit()

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> Notification | None:
        """Mark a specific notification as read."""
        notification = await self.repo.get_by_id_and_user_id(notification_id, user_id)
        if not notification:
            return None
        notification.is_read = True
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        return notification

    async def clear_all(self, user_id: uuid.UUID) -> None:
        """Delete all notifications for a user."""
        await self.repo.clear_all(user_id)
        await self.db.commit()

    async def delete_notification(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Delete a specific notification."""
        notification = await self.repo.get_by_id_and_user_id(notification_id, user_id)
        if not notification:
            return False
        await self.repo.delete(notification)
        await self.db.commit()
        return True

    async def create_notification(self, user_id: uuid.UUID, title: str, message: str, type: str = "general") -> Notification:
        """Create an in-app notification in the database."""
        notification = await self.repo.create({
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": type,
            "is_read": False
        })
        await self.db.commit()
        return notification

    async def send_multichannel_notification(
        self,
        user_id: uuid.UUID,
        title: str,
        message: str,
        type: str = "general",
        attachments: list[tuple[str, bytes, str]] | None = None
    ) -> None:
        """
        Sends notifications across channels based on user preferences.
        """
        # Fetch user details
        stmt_user = select(User).where(User.id == user_id)
        res_user = await self.db.execute(stmt_user)
        user = res_user.scalar_one_or_none()
        if not user:
            logger.warning(f"User {user_id} not found for notification.")
            return

        # Fetch patient profile if exists
        stmt = select(Patient).where(Patient.user_id == user_id)
        res = await self.db.execute(stmt)
        patient = res.scalar_one_or_none()

        email_enabled = True
        sms_enabled = True
        whatsapp_enabled = False
        push_enabled = True

        if patient:
            email_enabled = patient.notification_email
            sms_enabled = patient.notification_sms
            whatsapp_enabled = patient.notification_whatsapp
            push_enabled = patient.notification_push

        # 1. In-App notification (Always write to DB so it populates the bell dropdown history)
        db_noti = await self.repo.create({
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": type,
            "is_read": False
        })
        logger.info(f"[In-App] Created database notification record for user {user_id}: {title} - {message}")

        # Send via WebSocket realtime channel
        try:
            from app.core.websocket import manager as ws_manager
            await ws_manager.send_to_user(
                str(user_id),
                {
                    "event": "new_notification",
                    "data": {
                        "id": str(db_noti.id),
                        "title": title,
                        "message": message,
                        "type": type,
                        "is_read": False,
                        "created_at": db_noti.created_at.isoformat() if (hasattr(db_noti, "created_at") and db_noti.created_at) else None
                    }
                }
            )
        except Exception as ws_err:
            logger.warning(f"Failed to send realtime notification to user {user_id} via WebSocket: {ws_err}")

        # 2. Email
        if email_enabled and user.email:
            if type in ["patient_joined", "doctor_joined", "check_in", "reminder_10m", "reminder_1h", "billing"]:
                logger.info(f"[Email Notification Skip] Skipped email to {user.email} for realtime alert type: {type}")
            else:
                logger.info(f"[Email Notification] To user {user.email}: Subject: {title} | Body: {message}")
                try:
                    from app.utils.email import send_email
                    html_body = f"<h3>{title}</h3><p>{message}</p><br/><hr/><p style='font-size: 11px; color: #888;'>This is an automated notification from Vertical Clinic.</p>"
                    await send_email(
                        to=user.email,
                        subject=title,
                        html_body=html_body,
                        plain_body=message,
                        attachments=attachments
                    )
                except Exception as email_err:
                    logger.error(f"Failed to send email to {user.email}: {email_err}")

        # 3. SMS
        if sms_enabled and user.phone:
            logger.info(f"[SMS Notification Log] To user phone {user.phone}: {message}")
            # Actual Twilio integration
            from app.config import settings
            if settings.SMS_PROVIDER == "twilio" and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                # Check for dummy settings to avoid useless network calls / errors in dev
                is_dummy = (
                    "dummy" in settings.TWILIO_ACCOUNT_SID.lower()
                    or "your_" in settings.TWILIO_ACCOUNT_SID.lower()
                    or not settings.TWILIO_ACCOUNT_SID
                )
                if not is_dummy:
                    try:
                        from twilio.rest import Client
                        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                        # Twilio requires valid E.164 phone numbers (e.g. +1234567890)
                        to_phone = user.phone
                        if not to_phone.startswith("+"):
                            to_phone = f"+91{to_phone}" if len(to_phone) == 10 else f"+{to_phone}"
                        
                        client.messages.create(
                            body=f"{title}: {message}",
                            from_=settings.TWILIO_FROM_NUMBER,
                            to=to_phone
                        )
                        logger.info(f"[Twilio SMS Success] SMS sent to {to_phone}")
                    except Exception as twilio_err:
                        logger.error(f"[Twilio SMS Error] Failed to send SMS via Twilio: {twilio_err}")
                else:
                    logger.info("[Twilio SMS Dev] Dummy account SID detected. Skipping actual API request.")
            elif settings.SMS_PROVIDER == "fast2sms" and settings.FAST2SMS_API_KEY:
                logger.info(f"[Fast2SMS Log] Provider is fast2sms. API Key present. SMS body: {message}")

        # 4. WhatsApp
        if whatsapp_enabled and user.phone:
            logger.info(f"[WhatsApp Notification] To user {user.phone}: {message}")

        await self.db.commit()
