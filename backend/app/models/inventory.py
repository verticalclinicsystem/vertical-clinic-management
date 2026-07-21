"""
Inventory ORM models — medicines and stock transactions.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Medicine(Base):
    __tablename__ = "medicines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)  # Tablets, Capsules, etc.
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=0)
    supplier: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hsn_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    transactions: Mapped[list["StockTransaction"]] = relationship(
        "StockTransaction", back_populates="medicine", lazy="select"
    )

    @property
    def is_low_stock(self) -> bool:
        return self.stock_qty <= self.reorder_level

    def __repr__(self) -> str:
        return f"<Medicine name={self.name} stock={self.stock_qty}>"


class StockTransaction(Base):
    """Tracks every stock in/out/adjustment for audit trail."""
    __tablename__ = "stock_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    medicine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medicines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    change_qty: Mapped[int] = mapped_column(Integer, nullable=False)  # + for in, - for out
    transaction_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # purchase | dispense | adjustment | wastage
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )  # prescription_id or purchase_order_id
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    medicine: Mapped["Medicine"] = relationship("Medicine", back_populates="transactions")
