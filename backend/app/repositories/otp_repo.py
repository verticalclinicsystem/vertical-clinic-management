"""
OTP repository — CRUD and domain operations for otp_records table.
All DB interaction lives here; the service layer only calls these methods.
"""
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.otp import OtpRecord
from app.repositories.base import BaseRepository


class OtpRepository(BaseRepository[OtpRecord]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(OtpRecord, db)

    # ── Lookups ────────────────────────────────────────────────────────────────
    async def get_latest_active(self, email: str, purpose: str) -> OtpRecord | None:
        """Return the most recent non-used, non-expired OTP for a given email+purpose."""
        now = datetime.now(UTC)
        result = await self.db.execute(
            select(OtpRecord)
            .where(
                OtpRecord.email == email.lower().strip(),
                OtpRecord.purpose == purpose,
                OtpRecord.is_used == False,   # noqa: E712
                OtpRecord.expires_at > now,
            )
            .order_by(OtpRecord.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    # ── Write operations ───────────────────────────────────────────────────────
    async def create_otp(
        self,
        email: str,
        code: str,
        purpose: str,
        expire_minutes: int,
    ) -> OtpRecord:
        """
        Invalidate all existing active OTPs for this email+purpose,
        then persist a fresh OTP record.
        """
        await self.invalidate_all(email, purpose)
        expires_at = datetime.now(UTC) + timedelta(minutes=expire_minutes)
        return await self.create({
            "email": email.lower().strip(),
            "code": code,
            "purpose": purpose,
            "expires_at": expires_at,
        })

    async def mark_used(self, otp: OtpRecord) -> None:
        """Mark an OTP record as consumed so it cannot be reused."""
        await self.update(otp, {"is_used": True})

    async def increment_attempts(self, otp: OtpRecord) -> int:
        """Increment the failed-attempt counter and return the new total."""
        new_attempts = otp.attempts + 1
        await self.update(otp, {"attempts": new_attempts})
        return new_attempts

    async def invalidate_all(self, email: str, purpose: str) -> None:
        """Mark all existing active OTPs for the email+purpose as used."""
        await self.db.execute(
            update(OtpRecord)
            .where(
                OtpRecord.email == email.lower().strip(),
                OtpRecord.purpose == purpose,
                OtpRecord.is_used == False,  # noqa: E712
            )
            .values(is_used=True)
        )
        await self.db.flush()
