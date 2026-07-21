"""
Prescription repository — database queries for prescriptions and nested items.
"""
from __future__ import annotations

import uuid
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.prescription import Prescription, PrescriptionItem
from app.repositories.base import BaseRepository


class PrescriptionRepository(BaseRepository[Prescription]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Prescription, db)

    async def get_prescription_with_relations(self, prescription_id: uuid.UUID) -> Prescription | None:
        """Fetch a single prescription with items, patient, doctor, and consultation preloaded."""
        from app.models.patient import Patient
        from app.models.doctor import Doctor
        from app.models.consultation import Consultation
        stmt = (
            select(Prescription)
            .execution_options(populate_existing=True)
            .options(
                joinedload(Prescription.patient).joinedload(Patient.user),
                joinedload(Prescription.doctor).joinedload(Doctor.user),
                joinedload(Prescription.doctor).joinedload(Doctor.branch),
                joinedload(Prescription.doctor).joinedload(Doctor.slots),
                joinedload(Prescription.items),
                joinedload(Prescription.consultation)
            )
            .where(Prescription.id == prescription_id)
        )
        result = await self.db.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_prescriptions_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        doctor_id: uuid.UUID | None = None,
        consultation_id: uuid.UUID | None = None,
    ) -> tuple[list[Prescription], int]:
        """Fetch paginated, filtered prescriptions list."""
        from app.models.patient import Patient
        from app.models.doctor import Doctor
        from app.models.consultation import Consultation
        filters = []
        if patient_id:
            filters.append(Prescription.patient_id == patient_id)
        if doctor_id:
            filters.append(Prescription.doctor_id == doctor_id)
        if consultation_id:
            filters.append(Prescription.consultation_id == consultation_id)

        stmt = (
            select(Prescription)
            .options(
                joinedload(Prescription.patient).joinedload(Patient.user),
                joinedload(Prescription.doctor).joinedload(Doctor.user),
                joinedload(Prescription.doctor).joinedload(Doctor.slots),
                joinedload(Prescription.items),
                joinedload(Prescription.consultation)
            )
            .where(and_(*filters) if filters else True)
            .order_by(Prescription.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())

        count_stmt = select(func.count(Prescription.id)).where(and_(*filters) if filters else True)
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        return items, total

    async def save_item(self, item: PrescriptionItem) -> PrescriptionItem:
        """Save a prescription item."""
        self.db.add(item)
        await self.db.flush()
        return item

    async def get_recent_patient_prescriptions(self, patient_id: uuid.UUID, limit: int = 5) -> list[Prescription]:
        """Fetch recent prescriptions with doctor, user and items preloaded."""
        from app.models.doctor import Doctor
        stmt = (
            select(Prescription)
            .options(
                joinedload(Prescription.doctor).joinedload(Doctor.user),
                joinedload(Prescription.items)
            )
            .where(Prescription.patient_id == patient_id)
            .order_by(Prescription.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.unique().scalars().all())
