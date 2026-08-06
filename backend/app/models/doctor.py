"""
Doctor ORM model — extended professional profile linked to a User.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    specialization: Mapped[str] = mapped_column(String(150), nullable=False)
    qualification: Mapped[str | None] = mapped_column(String(200), nullable=True)
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    consultation_fee: Mapped[float] = mapped_column(Float, default=0.0)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    availability_metadata: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")  # type: ignore
    branch: Mapped["Branch"] = relationship("Branch", foreign_keys=[branch_id], lazy="selectin")  # type: ignore
    slots: Mapped[list["DoctorSlot"]] = relationship("DoctorSlot", back_populates="doctor", lazy="selectin")

    @property
    def branch_name(self) -> str | None:
        if "branch" in self.__dict__ and self.branch is not None:
            return self.branch.name
        return None

    def __repr__(self) -> str:
        return f"<Doctor specialization={self.specialization}>"


class DoctorSlot(Base):
    """Weekly availability slots per doctor."""
    __tablename__ = "doctor_slots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon ... 6=Sun
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)  # "09:00"
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)    # "13:00"
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="slots")
