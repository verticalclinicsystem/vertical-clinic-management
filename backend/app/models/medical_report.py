"""
MedicalReport ORM model — stores documents, X-Rays, lab results uploaded by patients.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MedicalReport(Base):
    __tablename__ = "medical_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    report_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # e.g., "X-Ray", "Blood Test", "CT Scan", "MRI"
    report_name: Mapped[str] = mapped_column(
        String(250), nullable=False
    )
    file_url: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationship to Patient
    patient: Mapped["Patient"] = relationship("Patient", lazy="selectin")  # type: ignore
