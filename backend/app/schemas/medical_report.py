"""
Pydantic schemas for Medical Reports.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class MedicalReportBase(BaseModel):
    report_type: str  # e.g., "X-Ray", "Blood Test", "CT Scan", "MRI"
    report_name: str
    file_url: str


class MedicalReportCreate(MedicalReportBase):
    patient_id: uuid.UUID


class MedicalReportOut(MedicalReportBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)
