"""
Doctor Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
import re
from pydantic import BaseModel, Field, model_validator

from app.schemas.auth import UserOut


class DoctorSlotBase(BaseModel):
    weekday: int = Field(..., ge=0, le=6, description="0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun")
    start_time: str = Field(..., description="Start time in HH:MM format (e.g. 09:00)")
    end_time: str = Field(..., description="End time in HH:MM format (e.g. 13:00)")
    slot_duration_minutes: int = Field(30, ge=10, le=120)
    is_active: bool = True

    @model_validator(mode="after")
    def validate_slot_times(self) -> "DoctorSlotBase":
        time_regex = r"^([01]\d|2[0-3]):[0-5]\d$"
        if not re.match(time_regex, self.start_time):
            raise ValueError(f"Invalid start_time format '{self.start_time}', expected HH:MM")
        if not re.match(time_regex, self.end_time):
            raise ValueError(f"Invalid end_time format '{self.end_time}', expected HH:MM")
        if self.start_time >= self.end_time:
            raise ValueError(f"start_time ({self.start_time}) must be earlier than end_time ({self.end_time})")

        s_h, s_m = map(int, self.start_time.split(':'))
        e_h, e_m = map(int, self.end_time.split(':'))
        diff_minutes = (e_h * 60 + e_m) - (s_h * 60 + s_m)
        if diff_minutes < self.slot_duration_minutes:
            raise ValueError(
                f"Shift interval {self.start_time}–{self.end_time} ({diff_minutes} mins) "
                f"must be at least as long as slot duration ({self.slot_duration_minutes} mins)."
            )
        return self


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
