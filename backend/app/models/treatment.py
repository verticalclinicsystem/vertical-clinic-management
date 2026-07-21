"""
Treatment plans ORM models — outlines structured therapy/procedures scheduled for patients.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime, Float, ForeignKey, String, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"

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

    title: Mapped[str] = mapped_column(String(200), nullable=False)  # e.g., "Full Mouth Orthodontic Treatment"
    status: Mapped[str] = mapped_column(
        String(50), default="active", index=True
    )  # active | completed | cancelled
    
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

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
    patient: Mapped["Patient"] = relationship("Patient", lazy="selectin")  # type: ignore
    doctor: Mapped["Doctor"] = relationship("Doctor", lazy="selectin")  # type: ignore
    
    procedures: Mapped[list["TreatmentProcedure"]] = relationship(
        "TreatmentProcedure", back_populates="treatment_plan", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<TreatmentPlan title={self.title} status={self.status}>"


class TreatmentProcedure(Base):
    __tablename__ = "treatment_procedures"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    treatment_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("treatment_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    procedure_name: Mapped[str] = mapped_column(String(200), nullable=False) # e.g., "Scaling & Root Planing"
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(
        String(50), default="planned"
    )  # planned | in_progress | completed | cancelled
    
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

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
    treatment_plan: Mapped["TreatmentPlan"] = relationship("TreatmentPlan", back_populates="procedures")

    def __repr__(self) -> str:
        return f"<TreatmentProcedure name={self.procedure_name} cost={self.cost} status={self.status}>"
