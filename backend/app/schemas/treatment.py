"""
Treatment Plan Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.doctor import DoctorOut
from app.schemas.patient import PatientOut


class TreatmentProcedureBase(BaseModel):
    procedure_name: str = Field(..., max_length=200)
    cost: float = Field(0.0, ge=0.0)
    status: str = Field("planned", max_length=50)  # planned | in_progress | completed | cancelled
    notes: str | None = None


class TreatmentProcedureCreate(TreatmentProcedureBase):
    pass


class TreatmentProcedureOut(TreatmentProcedureBase):
    id: uuid.UUID
    treatment_plan_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TreatmentPlanBase(BaseModel):
    title: str = Field(..., max_length=200)
    status: str = Field("active", max_length=50)   # active | completed | cancelled
    total_cost: float = Field(0.0, ge=0.0)
    notes: str | None = None


class TreatmentPlanCreate(TreatmentPlanBase):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    procedures: list[TreatmentProcedureCreate] = []


class TreatmentPlanUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    status: str | None = Field(None, max_length=50)
    total_cost: float | None = Field(None, ge=0.0)
    notes: str | None = None
    procedures: list[TreatmentProcedureCreate] | None = None


class TreatmentPlanOut(TreatmentPlanBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    patient: PatientOut | None = None
    doctor: DoctorOut | None = None
    procedures: list[TreatmentProcedureOut] = []

    class Config:
        from_attributes = True
