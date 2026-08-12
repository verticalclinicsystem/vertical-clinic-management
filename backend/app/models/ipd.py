"""
IPD (In-Patient Department) ORM models for Admission, Bed Management, Vitals tracking, and MAC.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BedCategory(Base):
    __tablename__ = "bed_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    base_charge_24h: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    hourly_overtime_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    beds: Mapped[list["Bed"]] = relationship("Bed", back_populates="category", cascade="all, delete-orphan")


class Bed(Base):
    __tablename__ = "beds"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bed_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    bed_number: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="available", nullable=False)  # "available", "occupied", "cleaning", "maintenance"
    last_cleaned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    branch: Mapped["Branch"] = relationship("Branch", lazy="selectin")  # type: ignore
    category: Mapped["BedCategory"] = relationship("BedCategory", back_populates="beds", lazy="selectin")


class Admission(Base):
    __tablename__ = "admissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    bed_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("beds.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    admitting_doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    admission_status: Mapped[str] = mapped_column(String(50), default="admitted", nullable=False)  # "admitted", "discharge_pending", "discharged"
    admission_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    discharge_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    diagnosis: Mapped[str] = mapped_column(Text, nullable=False)
    initial_deposit: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    insurance_approved_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    patient: Mapped["Patient"] = relationship("Patient", lazy="selectin")  # type: ignore
    bed: Mapped["Bed"] = relationship("Bed", lazy="selectin")
    doctor: Mapped["Doctor"] = relationship("Doctor", lazy="selectin")  # type: ignore


class BedTransferLog(Base):
    __tablename__ = "bed_transfer_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    admission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    from_bed_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("beds.id"), nullable=False)
    to_bed_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("beds.id"), nullable=False)
    transferred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    transferred_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    from_bed: Mapped["Bed"] = relationship("Bed", foreign_keys=[from_bed_id], lazy="selectin")
    to_bed: Mapped["Bed"] = relationship("Bed", foreign_keys=[to_bed_id], lazy="selectin")


class IpdClinicalRecord(Base):
    __tablename__ = "ipd_clinical_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    admission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    recorded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    temp: Mapped[float] = mapped_column(Float, default=98.6, nullable=False)
    pulse: Mapped[int] = mapped_column(Integer, default=72, nullable=False)
    systolic_bp: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    diastolic_bp: Mapped[int] = mapped_column(Integer, default=80, nullable=False)
    spo2: Mapped[int] = mapped_column(Integer, default=98, nullable=False)
    respiratory_rate: Mapped[int] = mapped_column(Integer, default=16, nullable=False)
    nursing_notes: Mapped[str] = mapped_column(Text, nullable=False)

    recorder: Mapped["User"] = relationship("User", lazy="selectin")  # type: ignore


class IpdMedicationAdministration(Base):
    __tablename__ = "ipd_medication_administrations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    admission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    medicine_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    scheduled_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    administered_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="scheduled", nullable=False)  # "scheduled", "administered", "missed"
    administered_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class IpdBillItem(Base):
    __tablename__ = "ipd_bill_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    admission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class IpdAdmissionRequest(Base):
    __tablename__ = "ipd_admission_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bed_categories.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    urgency: Mapped[str] = mapped_column(String(50), default="routine", nullable=False)  # "routine", "urgent", "emergency"
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)  # "pending", "admitted", "cancelled"
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    admitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient: Mapped["Patient"] = relationship("Patient", lazy="selectin")  # type: ignore
    doctor: Mapped["Doctor"] = relationship("Doctor", lazy="selectin")  # type: ignore
    category: Mapped["BedCategory | None"] = relationship("BedCategory", lazy="selectin")

