"""
Consultation ORM model — tracks clinical checkups, symptoms, diagnosis, and vitals.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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

    consultation_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    
    # Clinical Notes
    symptoms: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Follow-up Recommendation
    followup_advised: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    followup_after_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Vitals
    vitals_bp: Mapped[str | None] = mapped_column(String(20), nullable=True)  # e.g., "120/80"
    vitals_pulse: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vitals_temperature: Mapped[float | None] = mapped_column(Float, nullable=True)

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
    appointment: Mapped["Appointment | None"] = relationship("Appointment", lazy="selectin")  # type: ignore

    prescriptions: Mapped[list["Prescription"]] = relationship(
        "Prescription", back_populates="consultation", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Consultation patient_id={self.patient_id} doctor_id={self.doctor_id} date={self.consultation_datetime}>"
