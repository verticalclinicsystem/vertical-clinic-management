"""
Consultation repository — database queries for checkups and clinical records.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.consultation import Consultation
from app.repositories.base import BaseRepository


class ConsultationRepository(BaseRepository[Consultation]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Consultation, db)

    async def get_consultation_with_relations(self, consultation_id: uuid.UUID) -> Consultation | None:
        """Fetch a single consultation with all nested details preloaded."""
        from app.models.patient import Patient
        from app.models.doctor import Doctor
        stmt = (
            select(Consultation)
            .options(
                joinedload(Consultation.patient).joinedload(Patient.user),
                joinedload(Consultation.doctor).joinedload(Doctor.user),
                joinedload(Consultation.doctor).joinedload(Doctor.slots),
                joinedload(Consultation.branch),
                joinedload(Consultation.prescriptions)
            )
            .where(Consultation.id == consultation_id)
        )
        result = await self.db.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_consultations_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        doctor_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
        appointment_id: uuid.UUID | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> tuple[list[Consultation], int]:
        """Fetch paginated, filtered consultation records."""
        from app.models.patient import Patient
        from app.models.doctor import Doctor
        filters = []
        if patient_id:
            filters.append(Consultation.patient_id == patient_id)
        if doctor_id:
            filters.append(Consultation.doctor_id == doctor_id)
        if branch_id:
            filters.append(Consultation.branch_id == branch_id)
        if appointment_id:
            filters.append(Consultation.appointment_id == appointment_id)
        if start_date:
            filters.append(Consultation.consultation_datetime >= start_date)
        if end_date:
            filters.append(Consultation.consultation_datetime <= end_date)

        stmt = (
            select(Consultation)
            .options(
                joinedload(Consultation.patient).joinedload(Patient.user),
                joinedload(Consultation.doctor).joinedload(Doctor.user),
                joinedload(Consultation.doctor).joinedload(Doctor.slots),
                joinedload(Consultation.branch),
                joinedload(Consultation.prescriptions)
            )
            .where(and_(*filters) if filters else True)
            .order_by(Consultation.consultation_datetime.desc())
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())

        count_stmt = select(func.count(Consultation.id)).where(and_(*filters) if filters else True)
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        return items, total

    async def get_visits_count(self, patient_id: uuid.UUID, since_date: datetime) -> int:
        """Fetch visits count for a patient since a specific date."""
        stmt = (
            select(func.count(Consultation.id))
            .where(
                Consultation.patient_id == patient_id,
                Consultation.consultation_datetime >= since_date
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar_one() or 0

    async def get_doctor_treated_today_count(self, doctor_id: uuid.UUID, start_of_today: datetime) -> int:
        """Fetch count of patients treated by doctor today."""
        stmt = select(func.count(Consultation.id)).where(
            Consultation.doctor_id == doctor_id,
            Consultation.consultation_datetime >= start_of_today
        )
        res = await self.db.execute(stmt)
        return res.scalar_one() or 0

    async def get_doctor_completed_consultations_count(self, doctor_id: uuid.UUID) -> int:
        """Fetch total completed consultations count for a doctor."""
        stmt = select(func.count(Consultation.id)).where(
            Consultation.doctor_id == doctor_id
        )
        res = await self.db.execute(stmt)
        return res.scalar_one() or 0

    async def get_doctor_recent_consultations(self, doctor_id: uuid.UUID, limit: int = 5) -> list[Consultation]:
        """Fetch recent consultations for a doctor, preloading patient and branch."""
        from app.models.patient import Patient
        stmt = (
            select(Consultation)
            .options(
                joinedload(Consultation.patient).joinedload(Patient.user),
                joinedload(Consultation.branch)
            )
            .where(Consultation.doctor_id == doctor_id)
            .order_by(Consultation.consultation_datetime.desc())
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        return list(res.unique().scalars().all())
