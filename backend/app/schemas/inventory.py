"""
Inventory Pydantic schemas — request/response validation for medicines and stock levels.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class MedicineBase(BaseModel):
    name: str = Field(..., max_length=200)
    category: str | None = Field(None, max_length=100)
    description: str | None = None
    unit: str = Field(..., max_length=30)
    unit_price: float = Field(0.0, ge=0.0)
    stock_qty: int = Field(0, ge=0)
    reorder_level: int = Field(0, ge=0)
    supplier: str | None = Field(None, max_length=200)
    hsn_code: str | None = Field(None, max_length=20)
    is_active: bool = True


class MedicineCreate(MedicineBase):
    pass


class MedicineOut(MedicineBase):
    id: uuid.UUID
    is_low_stock: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
