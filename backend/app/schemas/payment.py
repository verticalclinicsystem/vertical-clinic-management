"""
Payment Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class PaymentBase(BaseModel):
    amount: float = Field(..., gt=0.0)
    payment_method: str = Field(..., max_length=50)  # cash | card | online_upi | bank_transfer
    transaction_reference: str | None = Field(None, max_length=150)


class PaymentCreate(PaymentBase):
    invoice_id: uuid.UUID


class PaymentOut(PaymentBase):
    id: uuid.UUID
    invoice_id: uuid.UUID
    patient_id: uuid.UUID
    payment_number: str
    payment_status: str
    payment_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True
