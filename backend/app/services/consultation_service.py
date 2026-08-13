"""
Consultation service — handles business logic and validation for patient visits.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    DoctorNotFoundError, PatientNotFoundError, BranchNotFoundError
)
from app.models.consultation import Consultation
from app.models.appointment import Appointment
from app.repositories.consultation_repo import ConsultationRepository
from app.repositories.doctor_repo import DoctorRepository
from app.repositories.patient_repo import PatientRepository
from app.repositories.branch_repo import BranchRepository
from app.repositories.appointment_repo import AppointmentRepository
from app.schemas.consultation import ConsultationCreate, ConsultationUpdate

logger = logging.getLogger(__name__)


class ConsultationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.consultation_repo = ConsultationRepository(db)
        self.doctor_repo = DoctorRepository(db)
        self.patient_repo = PatientRepository(db)
        self.branch_repo = BranchRepository(db)
        self.appointment_repo = AppointmentRepository(db)

    async def create_consultation(self, request: ConsultationCreate) -> Consultation:
        """Record a new patient consultation. Optionally marks associated appointment completed."""
        # 1. Verify patient, doctor, and branch exist
        patient = await self.patient_repo.get_by_id(request.patient_id)
        if not patient:
            raise PatientNotFoundError()

        doctor = await self.doctor_repo.get_by_id(request.doctor_id)
        if not doctor:
            raise DoctorNotFoundError()

        branch = await self.branch_repo.get_by_id(request.branch_id)
        if not branch:
            raise BranchNotFoundError()

        # 2. Insert consultation record
        consult_data = {
            "appointment_id": request.appointment_id,
            "patient_id": request.patient_id,
            "doctor_id": request.doctor_id,
            "branch_id": request.branch_id,
            "symptoms": request.symptoms,
            "diagnosis": request.diagnosis,
            "notes": request.notes,
            "vitals_bp": request.vitals_bp,
            "vitals_pulse": request.vitals_pulse,
            "vitals_temperature": request.vitals_temperature,
            "followup_advised": request.followup_advised,
            "followup_after_days": request.followup_after_days,
        }
        
        created = await self.consultation_repo.create(consult_data)

        # 3. Auto-update linked appointment to "completed" if present
        if request.appointment_id:
            appt = await self.appointment_repo.get_by_id(request.appointment_id)
            if appt:
                await self.appointment_repo.update(appt, {"status": "completed"})

        await self.db.commit()

        # Broadcast queue update
        try:
            from app.core.websocket import manager
            if request.appointment_id and appt:
                await manager.send_to_branch(str(appt.branch_id), {"event": "queue_updated", "branch_id": str(appt.branch_id)})
            else:
                await manager.broadcast({"event": "queue_updated"})
        except Exception as ws_err:
            logger.warning(f"Failed to broadcast websocket event: {ws_err}")

        logger.info(f"Consultation registered: {created.id}")
        return await self.get_consultation(created.id)

    async def get_consultation(self, consultation_id: uuid.UUID) -> Consultation:
        """Fetch details of a single consultation."""
        consultation = await self.consultation_repo.get_consultation_with_relations(consultation_id)
        if not consultation:
            from app.core.exceptions import BaseAPIException
            class ConsultationNotFoundError(BaseAPIException):
                def __init__(self):
                    super().__init__(
                        status_code=404,
                        error_code="CONSULTATION_NOT_FOUND",
                        message="Consultation record not found."
                    )
            raise ConsultationNotFoundError()
        return consultation

    async def list_consultations(
        self,
        *,
        page: int = 1,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        doctor_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
        appointment_id: uuid.UUID | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> tuple[list[Consultation], int]:
        """List paginated consultation history."""
        skip = (page - 1) * limit
        return await self.consultation_repo.get_consultations_paginated(
            skip=skip,
            limit=limit,
            patient_id=patient_id,
            doctor_id=doctor_id,
            branch_id=branch_id,
            appointment_id=appointment_id,
            start_date=start_date,
            end_date=end_date,
        )
