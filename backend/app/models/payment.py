"""
Payment ORM model — tracks patient financial transactions.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    payment_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )  # e.g., PAY-2026-0001

    amount: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False
    )

    payment_method: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # cash | card | online_upi | bank_transfer

    payment_status: Mapped[str] = mapped_column(
        String(30), default="completed", nullable=False
    )  # pending | completed | failed

    transaction_reference: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )  # Gateway Transaction ID

    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

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
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments", lazy="selectin")  # type: ignore
    patient: Mapped["Patient"] = relationship("Patient", lazy="selectin")  # type: ignore

    def __repr__(self) -> str:
        return f"<Payment number={self.payment_number} amount={self.amount}>"
