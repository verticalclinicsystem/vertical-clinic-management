"""
Doctor Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.auth import UserOut


class DoctorSlotBase(BaseModel):
    weekday: int = Field(..., ge=0, le=6, description="0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun")
    start_time: str = Field(..., description="Start time in HH:MM format (e.g. 09:00)")
    end_time: str = Field(..., description="End time in HH:MM format (e.g. 13:00)")
    slot_duration_minutes: int = Field(30, ge=10, le=120)
    is_active: bool = True


class DoctorSlotCreate(DoctorSlotBase):
    pass


class DoctorSlotOut(DoctorSlotBase):
    id: uuid.UUID
    doctor_id: uuid.UUID

    class Config:
        from_attributes = True


class DoctorBase(BaseModel):
    specialization: str
    qualification: str | None = None
    experience_years: int = 0
    consultation_fee: float = 0.0
    bio: str | None = None
    registration_number: str | None = None
    is_available: bool = True
    availability_metadata: str | None = None


class DoctorUpdate(BaseModel):
    specialization: str | None = None
    qualification: str | None = None
    experience_years: int | None = None
    consultation_fee: float | None = None
    bio: str | None = None
    registration_number: str | None = None
    is_available: bool | None = None
    branch_id: uuid.UUID | None = None
    availability_metadata: str | None = None


class DoctorOut(DoctorBase):
    id: uuid.UUID
    user_id: uuid.UUID
    branch_id: uuid.UUID | None
    branch_name: str | None = None
    created_at: datetime
    user: UserOut | None = None
    slots: list[DoctorSlotOut] = []
    availability_metadata: str | None = None

    class Config:
        from_attributes = True
