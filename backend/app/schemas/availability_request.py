"""
AvailabilityChangeRequest Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime, date
from pydantic import BaseModel, Field


class AvailabilityChangeRequestCreate(BaseModel):
    request_type: str = Field(..., description="Type of request: lunch_break, shift_timing, teleconsultation, leave")
    proposed_start_time: str | None = Field(None, description="Proposed start time format HH:MM")
    proposed_end_time: str | None = Field(None, description="Proposed end time format HH:MM")
    proposed_start_date: date | None = Field(None, description="Proposed start date")
    proposed_end_date: date | None = Field(None, description="Proposed end date")
    reason: str = Field(..., min_length=5, description="Doctor's reason or description of the issue")


class AvailabilityChangeRequestUpdate(BaseModel):
    status: str = Field(..., description="Target status: approved or rejected")
    rejection_reason: str | None = Field(None, description="Optional rejection description")


class AvailabilityChangeRequestOut(BaseModel):
    id: uuid.UUID
    doctor_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    doctor_name: str | None = None
    request_type: str
    proposed_start_time: str | None = None
    proposed_end_time: str | None = None
    proposed_start_date: date | None = None
    proposed_end_date: date | None = None
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
