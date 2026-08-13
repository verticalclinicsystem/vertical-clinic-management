"""
Appointment ORM model — manages patient bookings, scheduling, and statuses.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, String, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    appointment_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    treatment_type: Mapped[str] = mapped_column(
        String(150), nullable=False
    )  # e.g., "Braces Adjustment", "Routine Checkup"
    consultation_type: Mapped[str] = mapped_column(
        String(50), default="in_person"
    )  # "in_person" | "teleconsultation"
    status: Mapped[str] = mapped_column(
        String(50), default="pending", index=True
    )  # "pending" | "confirmed" | "completed" | "cancelled" | "no_show"
    
    token_number: Mapped[int | None] = mapped_column(default=None, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Reschedule & Cancellation Tracking
    reschedule_count: Mapped[int] = mapped_column(default=0, nullable=False)
    cancelled_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Reminder Tracking
    reminder_sent_24h: Mapped[bool] = mapped_column(default=False, nullable=False)
    reminder_sent_2h: Mapped[bool] = mapped_column(default=False, nullable=False)
    reminder_sent_1h: Mapped[bool] = mapped_column(default=False, nullable=False)
    reminder_sent_10m: Mapped[bool] = mapped_column(default=False, nullable=False)

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
    patient: Mapped["Patient"] = relationship("Patient", lazy="selectin")  # type: ignore
    doctor: Mapped["Doctor"] = relationship("Doctor", lazy="selectin")  # type: ignore
    branch: Mapped["Branch"] = relationship("Branch", lazy="selectin")  # type: ignore
    teleconsultation: Mapped["TeleConsultation | None"] = relationship("TeleConsultation", back_populates="appointment", cascade="all, delete-orphan", uselist=False, lazy="selectin")  # type: ignore

    @property
    def branch_name(self) -> str | None:
        if "branch" in self.__dict__ and self.branch is not None:
            return self.branch.name
        return None

    def __repr__(self) -> str:
        return f"<Appointment patient_id={self.patient_id} doctor_id={self.doctor_id} status={self.status}>"
