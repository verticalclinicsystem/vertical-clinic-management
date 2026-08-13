"""
Pydantic schemas for Patient-to-Clinic Direct Messaging.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ChatMessageCreate(BaseModel):
    appointment_id: UUID = Field(..., description="Target appointment UUID")
    message_text: str = Field(..., min_length=1, max_length=2000, description="Chat message body")
    receiver_id: UUID | None = Field(None, description="Optional target user UUID")


class ChatMessageOut(BaseModel):
    id: UUID
    appointment_id: UUID | None
    sender_id: UUID
    sender_name: str
    sender_role: str
    receiver_id: UUID | None
    message_text: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
