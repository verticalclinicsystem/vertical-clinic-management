"""
Prescription ORM models — details of medicines prescribed during consultations.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime, ForeignKey, Integer, String, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False,
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

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)  # General instructions/notes
    status: Mapped[str] = mapped_column(String(50), default="Pending", server_default="Pending", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    consultation: Mapped["Consultation"] = relationship("Consultation", back_populates="prescriptions", lazy="selectin")  # type: ignore
    patient: Mapped["Patient"] = relationship("Patient", lazy="selectin")  # type: ignore
    doctor: Mapped["Doctor"] = relationship("Doctor", lazy="selectin")  # type: ignore
    
    items: Mapped[list["PrescriptionItem"]] = relationship(
        "PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Prescription patient_id={self.patient_id} doctor_id={self.doctor_id} date={self.created_at}>"


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("prescriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    medicine_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medicines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    medicine_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)        # e.g., "1-0-1", "5ml"
    duration: Mapped[str] = mapped_column(String(50), nullable=False)       # e.g., "5 days", "1 week"
    instructions: Mapped[str | None] = mapped_column(String(250), nullable=True) # e.g., "After food"
    quantity: Mapped[int] = mapped_column(Integer, default=10, server_default="10", nullable=False)

    # Relationships
    prescription: Mapped["Prescription"] = relationship("Prescription", back_populates="items")
    medicine: Mapped["Medicine | None"] = relationship("Medicine", lazy="selectin")  # type: ignore

    def __repr__(self) -> str:
        return f"<PrescriptionItem name={self.medicine_name} dosage={self.dosage}>"
