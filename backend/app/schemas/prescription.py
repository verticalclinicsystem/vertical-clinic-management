"""
Prescription Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.doctor import DoctorOut
from app.schemas.patient import PatientOut


class PrescriptionItemBase(BaseModel):
    medicine_id: uuid.UUID | None = None
    medicine_name: str = Field(..., max_length=200)
    dosage: str = Field(..., max_length=100)        # e.g., "1-0-1"
    duration: str = Field(..., max_length=50)       # e.g., "5 days"
    instructions: str | None = Field(None, max_length=250)
    quantity: int = Field(10, ge=0)


class PrescriptionItemCreate(PrescriptionItemBase):
    pass


class PrescriptionItemOut(PrescriptionItemBase):
    id: uuid.UUID
    prescription_id: uuid.UUID

    class Config:
        from_attributes = True


class ConsultationSummary(BaseModel):
    """Slim consultation summary embedded in PrescriptionOut so the patient
    portal can display the doctor's actual AI-assisted diagnosis & symptoms."""
    id: uuid.UUID
    symptoms: str | None = None
    diagnosis: str | None = None
    notes: str | None = None
    vitals_bp: str | None = None
    vitals_pulse: int | None = None
    vitals_temperature: float | None = None
    consultation_datetime: datetime | None = None

    class Config:
        from_attributes = True


class PrescriptionBase(BaseModel):
    notes: str | None = None


class PrescriptionCreate(PrescriptionBase):
    consultation_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    items: list[PrescriptionItemCreate] = []


class PrescriptionUpdate(BaseModel):
    notes: str | None = None
    status: str | None = None
    items: list[PrescriptionItemCreate] | None = None


class PrescriptionOut(PrescriptionBase):
    id: uuid.UUID
    consultation_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    status: str
    created_at: datetime
    updated_at: datetime
    
    patient: PatientOut | None = None
    doctor: DoctorOut | None = None
    items: list[PrescriptionItemOut] = []
    # Nested consultation — provides AI-generated symptoms/diagnosis to patient portal
    consultation: ConsultationSummary | None = None

    class Config:
        from_attributes = True
