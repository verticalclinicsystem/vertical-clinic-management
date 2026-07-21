"""
Patient Pydantic schemas — request/response validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel
from app.schemas.auth import UserOut


class PatientBase(BaseModel):
    patient_code: str
    date_of_birth: datetime | None = None
    gender: str | None = None
    blood_group: str | None = None
    allergies: str | None = None
    chronic_conditions: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_relation: str | None = None
    emergency_contact_phone: str | None = None
    insurance_provider: str | None = None
    insurance_policy_no: str | None = None
    preferred_payment_method: str | None = None


class PatientCreate(BaseModel):
    full_name: str
    email: str
    phone: str
    date_of_birth: datetime | None = None
    gender: str | None = None
    blood_group: str | None = None
    allergies: str | None = None
    chronic_conditions: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_relation: str | None = None
    emergency_contact_phone: str | None = None
    insurance_provider: str | None = None
    insurance_policy_no: str | None = None
    preferred_payment_method: str | None = None
    preferred_branch_id: uuid.UUID | None = None


class PatientUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    date_of_birth: datetime | None = None
    gender: str | None = None
    blood_group: str | None = None
    chronic_conditions: str | None = None
    allergies: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_relation: str | None = None
    emergency_contact_phone: str | None = None
    insurance_provider: str | None = None
    insurance_policy_no: str | None = None
    preferred_payment_method: str | None = None
    preferred_branch_id: uuid.UUID | None = None



class PatientOut(PatientBase):
    id: uuid.UUID
    user_id: uuid.UUID
    preferred_branch_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    user: UserOut | None = None

    model_config = {"from_attributes": True}


class FollowUpRecommendationOut(BaseModel):
    id: uuid.UUID
    consultation_id: uuid.UUID
    doctor_id: uuid.UUID
    doctor_name: str
    branch_id: uuid.UUID
    branch_name: str
    recommended_date: datetime
    treatment_type: str
    notes: str
    status: str  # "recommended" | "booked"

    model_config = {"from_attributes": True}


class PatientPreferencesOut(BaseModel):
    language: str | None = "English"
    notification_email: bool = True
    notification_sms: bool = True
    notification_whatsapp: bool = False
    notification_push: bool = True
    preferred_doctor_id: uuid.UUID | None = None
    preferred_branch_id: uuid.UUID | None = None
    consultation_preference: str | None = "in_person"

    model_config = {"from_attributes": True}


class PatientPreferencesUpdate(BaseModel):
    language: str | None = None
    notification_email: bool | None = None
    notification_sms: bool | None = None
    notification_whatsapp: bool | None = None
    notification_push: bool | None = None
    preferred_doctor_id: uuid.UUID | None = None
    preferred_branch_id: uuid.UUID | None = None
    consultation_preference: str | None = None


