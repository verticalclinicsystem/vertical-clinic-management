"""
Invoice ORM model — stores patient billing and balance records.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    consultation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consultations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("treatment_plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    admission_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admissions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    admission_ids_json: Mapped[str | None] = mapped_column(
        String(1000), nullable=True
    )

    invoice_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )  # e.g., INV-2026-0001

    total_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    discount_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    grand_total: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    amount_paid: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )
    balance_due: Mapped[float] = mapped_column(
        Numeric(10, 2), default=0.0, nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30), default="unpaid", nullable=False
    )  # unpaid | partially_paid | paid | cancelled

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
    consultation: Mapped["Consultation | None"] = relationship("Consultation", lazy="selectin")  # type: ignore
    treatment_plan: Mapped["TreatmentPlan | None"] = relationship("TreatmentPlan", lazy="selectin")  # type: ignore
    admission: Mapped["Admission | None"] = relationship("Admission", lazy="selectin")  # type: ignore
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin"
    )  # type: ignore

    def __repr__(self) -> str:
        return f"<Invoice number={self.invoice_number} balance={self.balance_due}>"
