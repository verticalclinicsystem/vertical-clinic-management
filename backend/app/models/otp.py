"""
OtpRecord ORM model — stores short-lived OTP codes for:
  • email / phone verification  (purpose="verify")
  • password reset              (purpose="reset")
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OtpRecord(Base):
    __tablename__ = "otp_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Which user this OTP belongs to (email used as key — works pre- and post-verify)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # The 6-digit code
    code: Mapped[str] = mapped_column(String(10), nullable=False)

    # "verify" → account verification OTP
    # "reset"  → password reset OTP
    purpose: Mapped[str] = mapped_column(
        Enum("verify", "reset", name="otp_purpose"),
        nullable=False,
        index=True,
    )

    # How many times the user has tried an incorrect code
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Marked True once successfully consumed so it cannot be reused
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # When this OTP expires
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<OtpRecord email={self.email} purpose={self.purpose} used={self.is_used}>"
