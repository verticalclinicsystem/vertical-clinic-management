"""
Consultation Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.branch import BranchOut
from app.schemas.doctor import DoctorOut
from app.schemas.patient import PatientOut


class ConsultationBase(BaseModel):
    symptoms: str | None = None
    diagnosis: str | None = None
    notes: str | None = None
    vitals_bp: str | None = Field(None, max_length=20)
    vitals_pulse: int | None = Field(None, ge=0)
    vitals_temperature: float | None = Field(None, ge=0.0)
    followup_advised: bool = False
    followup_after_days: int = 0


class ConsultationCreate(ConsultationBase):
    appointment_id: uuid.UUID | None = None
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    branch_id: uuid.UUID


class ConsultationUpdate(ConsultationBase):
    pass


class ConsultationOut(ConsultationBase):
    id: uuid.UUID
    appointment_id: uuid.UUID | None
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    branch_id: uuid.UUID
    consultation_datetime: datetime
    created_at: datetime
    updated_at: datetime

    patient: PatientOut | None = None
    doctor: DoctorOut | None = None
    branch: BranchOut | None = None

    class Config:
        from_attributes = True
