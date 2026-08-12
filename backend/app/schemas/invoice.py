"""
Invoice Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.patient import PatientOut


class InvoiceBase(BaseModel):
    total_amount: float = Field(0.0, ge=0.0)
    discount_amount: float = Field(0.0, ge=0.0)
    tax_amount: float = Field(0.0, ge=0.0)
    status: str = Field("unpaid", max_length=30)  # unpaid | partially_paid | paid | cancelled


class InvoiceCreate(InvoiceBase):
    patient_id: uuid.UUID
    consultation_id: uuid.UUID | None = None
    treatment_plan_id: uuid.UUID | None = None
    admission_id: uuid.UUID | None = None
    admission_ids: list[uuid.UUID] = []


class InvoiceUpdate(BaseModel):
    total_amount: float | None = Field(None, ge=0.0)
    discount_amount: float | None = Field(None, ge=0.0)
    tax_amount: float | None = Field(None, ge=0.0)
    status: str | None = Field(None, max_length=30)
    consultation_id: uuid.UUID | None = None
    treatment_plan_id: uuid.UUID | None = None
    admission_id: uuid.UUID | None = None
    admission_ids: list[uuid.UUID] = []


class InvoiceLineItem(BaseModel):
    """Line item for invoice receipt breakdown."""
    description: str
    amount: float


class InvoicePrescriptionItem(BaseModel):
    """Slim prescription item embedded in InvoiceOut for billing breakdown."""
    medicine_name: str
    dosage: str
    duration: str
    instructions: str | None = None

    class Config:
        from_attributes = True


class InvoiceOut(InvoiceBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    consultation_id: uuid.UUID | None
    treatment_plan_id: uuid.UUID | None
    admission_id: uuid.UUID | None = None
    admission_ids: list[uuid.UUID] = []
    invoice_number: str
    grand_total: float
    amount_paid: float
    balance_due: float
    created_at: datetime
    updated_at: datetime

    patient: PatientOut | None = None
    # Medicine items from the linked prescription (for bill breakdown)
    prescription_items: list[InvoicePrescriptionItem] = []
    # Full itemized breakdown lines (consultation, medicines, procedures, IPD stay, deposits)
    items_breakdown: list[InvoiceLineItem] = []

    class Config:
        from_attributes = True
