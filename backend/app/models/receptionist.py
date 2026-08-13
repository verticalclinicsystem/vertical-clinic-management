"""
Receptionist ORM model — receptionist profile linked to a User account.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Receptionist(Base):
    __tablename__ = "receptionists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Link to User account
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Employee identity
    employee_id: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )  # e.g. RC-10001

    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    shift_start: Mapped[str] = mapped_column(String(10), default="09:00", nullable=False)
    shift_end: Mapped[str] = mapped_column(String(10), default="17:00", nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="selectin")  # type: ignore
    branch: Mapped["Branch"] = relationship("Branch", foreign_keys=[branch_id], lazy="selectin")  # type: ignore

    @property
    def branch_name(self) -> str | None:
        if "branch" in self.__dict__ and self.branch is not None:
            return self.branch.name
        return None

    def __repr__(self) -> str:
        return f"<Receptionist employee_id={self.employee_id}>"
