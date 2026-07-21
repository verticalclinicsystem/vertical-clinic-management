"""
TeleConsultation ORM model — tracks secure video consultation meetings.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, String, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TeleConsultation(Base):
    __tablename__ = "tele_consultations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    meeting_url: Mapped[str] = mapped_column(String(500), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expiry_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # "Ready" | "Active" | "Closed"
    status: Mapped[str] = mapped_column(String(50), default="Ready", index=True)
    
    meeting_link_sent: Mapped[bool] = mapped_column(default=False, nullable=False)

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
    appointment: Mapped["Appointment"] = relationship("Appointment", back_populates="teleconsultation")  # type: ignore

    def __repr__(self) -> str:
        return f"<TeleConsultation appointment_id={self.appointment_id} status={self.status} url={self.meeting_url}>"
