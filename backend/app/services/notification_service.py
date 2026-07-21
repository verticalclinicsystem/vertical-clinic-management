import logging
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.user import User

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_notification(self, user_id: uuid.UUID, title: str, message: str, type: str = "general") -> Notification:
        """Create an in-app notification in the database."""
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            is_read=False
        )
        self.db.add(notification)
        await self.db.flush()
        await self.db.commit()
        return notification

    async def send_multichannel_notification(
        self,
        user_id: uuid.UUID,
        title: str,
        message: str,
        type: str = "general"
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

        # 1. In-App/Push notification
        if push_enabled:
            # Create a DB notification record
            notification = Notification(
                user_id=user_id,
                title=title,
                message=message,
                type=type,
                is_read=False
            )
            self.db.add(notification)
            await self.db.flush()
            logger.info(f"[In-App Push] Created notification for user {user_id}: {title} - {message}")

        # 2. Email
        if email_enabled and user.email:
            logger.info(f"[Email Notification] To user {user.email}: Subject: {title} | Body: {message}")

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
