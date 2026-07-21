"""
Patient ORM model — clinical profile linked to a User account.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, String, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Link to User account
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Patient-specific identity
    patient_code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )  # e.g. PT-10234

    # Clinical demographics
    date_of_birth: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    gender: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # M | F | Other
    blood_group: Mapped[str | None] = mapped_column(String(5), nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    chronic_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    emergency_contact_relation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Insurance & Payment Preferences
    insurance_provider: Mapped[str | None] = mapped_column(String(200), nullable=True)
    insurance_policy_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preferred_payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Branch preference
    preferred_branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Preferences
    language: Mapped[str | None] = mapped_column(String(50), default="English", nullable=True)
    notification_email: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notification_sms: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notification_whatsapp: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notification_push: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    preferred_doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="SET NULL"),
        nullable=True,
    )
    consultation_preference: Mapped[str | None] = mapped_column(String(50), default="in_person", nullable=True)


    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")  # type: ignore

    def __repr__(self) -> str:
        return f"<Patient code={self.patient_code}>"
