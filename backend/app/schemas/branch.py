"""
Branch Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator

# Indian GSTIN format regex
GST_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


def _clean_and_validate_phone(v: str | None) -> str | None:
    if v is None:
        return None
    digits = "".join(c for c in v if c.isdigit() or c == "+")
    if len(digits.replace("+", "")) < 10:
        raise ValueError("Phone number must have at least 10 digits")
    return digits


def _validate_gst_number(v: str | None) -> str | None:
    if v is None:
        return None
    v_upper = v.upper().strip()
    if not GST_REGEX.match(v_upper):
        raise ValueError("Invalid GST number format (must be a valid 15-digit Indian GSTIN, e.g., 24AACCS1234K1ZP)")
    return v_upper


class BranchBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    gst_number: str | None = None
    opening_hour: str = Field("09:00", description="Branch opening hour format HH:MM")
    closing_hour: str = Field("21:00", description="Branch closing hour format HH:MM")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        return _clean_and_validate_phone(v)

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, v: str | None) -> str | None:
        return _validate_gst_number(v)


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    code: str | None = Field(None, min_length=2, max_length=20)
    address: str | None = None
    city: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    gst_number: str | None = None
    opening_hour: str | None = None
    closing_hour: str | None = None
    is_active: bool | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        return _clean_and_validate_phone(v)

    @field_validator("gst_number")
    @classmethod
    def validate_gst(cls, v: str | None) -> str | None:
        return _validate_gst_number(v)


class BranchOut(BranchBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BranchListResponse(BaseModel):
    items: list[BranchOut]
    total: int
    page: int
    limit: int
    pages: int


class BranchDashboardResponse(BaseModel):
    branch: str
    today_appointments: int
    today_patients: int
    doctor_count: int
    staff_count: int
    today_revenue: float
    low_stock_items: int
