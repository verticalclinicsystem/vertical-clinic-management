"""
Receptionist Pydantic schemas — validation for receptionist routes.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.auth import UserOut


class ReceptionistBase(BaseModel):
    shift_start: str = Field("09:00", min_length=5, max_length=10)
    shift_end: str = Field("17:00", min_length=5, max_length=10)
    bio: str | None = Field(None, max_length=500)


class ReceptionistCreate(ReceptionistBase):
    user_id: uuid.UUID
    branch_id: uuid.UUID | None = None


class ReceptionistUpdate(BaseModel):
    shift_start: str | None = Field(None, min_length=5, max_length=10)
    shift_end: str | None = Field(None, min_length=5, max_length=10)
    bio: str | None = Field(None, max_length=500)
    branch_id: uuid.UUID | None = None
    is_active: bool | None = None


class ReceptionistOut(ReceptionistBase):
    id: uuid.UUID
    user_id: uuid.UUID
    employee_id: str
    branch_id: uuid.UUID | None
    branch_name: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    user: UserOut | None = None

    model_config = {"from_attributes": True}
