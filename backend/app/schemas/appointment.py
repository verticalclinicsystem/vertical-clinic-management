"""
Appointment Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class PatientUserMinOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None = None
    phone: str | None = None
    role: str

    class Config:
        from_attributes = True


class PatientMinOut(BaseModel):
    id: uuid.UUID
    patient_code: str
    user: PatientUserMinOut | None = None

    class Config:
        from_attributes = True


class DoctorUserMinOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None = None
    phone: str | None = None
    role: str

    class Config:
        from_attributes = True


class DoctorMinOut(BaseModel):
    id: uuid.UUID
    specialization: str
    qualification: str | None = None
    experience_years: int = 0
    consultation_fee: float = 0.0
    user: DoctorUserMinOut | None = None

    class Config:
        from_attributes = True


class BranchMinOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    city: str | None = None

    class Config:
        from_attributes = True


class AppointmentBase(BaseModel):
    appointment_datetime: datetime
    treatment_type: str = Field(..., max_length=150)
    consultation_type: str = Field("in_person", max_length=50)  # "in_person" | "teleconsultation"
    notes: str | None = None

    @field_validator("consultation_type")
    @classmethod
    def validate_consultation_type(cls, v: str) -> str:
        if v not in ("in_person", "teleconsultation"):
            raise ValueError("consultation_type must be either 'in_person' or 'teleconsultation'")
        return v



class AppointmentCreate(AppointmentBase):
    doctor_id: uuid.UUID
    branch_id: uuid.UUID
    patient_id: uuid.UUID | None = None



class AppointmentUpdate(BaseModel):
    appointment_datetime: datetime | None = None
    treatment_type: str | None = Field(None, max_length=150)
    consultation_type: str | None = Field(None, max_length=50)
    status: str | None = Field(None, max_length=50)  # "pending" | "confirmed" | "completed" | "cancelled" | "no_show"
    notes: str | None = None
    cancelled_by: str | None = None
    cancel_reason: str | None = None

    @field_validator("consultation_type")
    @classmethod
    def validate_consultation_type(cls, v: str | None) -> str | None:
        if v is not None and v not in ("in_person", "teleconsultation"):
            raise ValueError("consultation_type must be either 'in_person' or 'teleconsultation'")
        return v



class AppointmentOut(AppointmentBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    branch_id: uuid.UUID
    branch_name: str | None = None
    status: str
    reschedule_count: int
    cancelled_by: str | None
    cancel_reason: str | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime
    
    patient: PatientMinOut | None = None
    doctor: DoctorMinOut | None = None
    branch: BranchMinOut | None = None

    def map_status_for_role(self, role: str) -> None:
        if role == "patient":
            if self.status == "completed":
                self.status = "completed"
            elif self.status in ["cancelled", "rejected"]:
                self.status = "cancelled"
            elif self.reschedule_count > 0:
                self.status = "rescheduled"
            else:
                self.status = "confirmed"

    class Config:
        from_attributes = True
