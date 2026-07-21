"""
AvailabilityChangeRequest ORM model.
"""
import uuid
from datetime import datetime, date

from sqlalchemy import DateTime, ForeignKey, String, Text, Date, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AvailabilityChangeRequest(Base):
    __tablename__ = "availability_change_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    request_type: Mapped[str] = mapped_column(String(50), nullable=False) # lunch_break, shift_timing, teleconsultation, leave
    proposed_start_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    proposed_end_time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    proposed_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    proposed_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationship
    doctor: Mapped["Doctor"] = relationship("Doctor", lazy="selectin") # type: ignore
