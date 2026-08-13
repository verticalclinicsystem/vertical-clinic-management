"""
Treatment plan repository — database queries for multi-stage procedures.
"""
from __future__ import annotations

import uuid
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.treatment import TreatmentPlan, TreatmentProcedure
from app.repositories.base import BaseRepository


class TreatmentRepository(BaseRepository[TreatmentPlan]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(TreatmentPlan, db)

    async def get_treatment_plan_with_relations(self, plan_id: uuid.UUID) -> TreatmentPlan | None:
        """Fetch treatment plan with patient, doctor, and procedures preloaded."""
        from app.models.patient import Patient
        from app.models.doctor import Doctor
        stmt = (
            select(TreatmentPlan)
            .execution_options(populate_existing=True)
            .options(
                joinedload(TreatmentPlan.patient).joinedload(Patient.user),
                joinedload(TreatmentPlan.doctor).joinedload(Doctor.user),
                joinedload(TreatmentPlan.doctor).joinedload(Doctor.slots),
                joinedload(TreatmentPlan.procedures)
            )
            .where(TreatmentPlan.id == plan_id)
        )
        result = await self.db.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_treatment_plans_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        doctor_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[TreatmentPlan], int]:
        """Fetch paginated, filtered list of treatment plans."""
        from app.models.patient import Patient
        from app.models.doctor import Doctor
        filters = []
        if patient_id:
            filters.append(TreatmentPlan.patient_id == patient_id)
        if doctor_id:
            filters.append(TreatmentPlan.doctor_id == doctor_id)
        if status:
            filters.append(TreatmentPlan.status == status)

        stmt = (
            select(TreatmentPlan)
            .options(
                joinedload(TreatmentPlan.patient).joinedload(Patient.user),
                joinedload(TreatmentPlan.doctor).joinedload(Doctor.user),
                joinedload(TreatmentPlan.procedures)
            )
            .where(and_(*filters) if filters else True)
            .order_by(TreatmentPlan.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())

        count_stmt = select(func.count(TreatmentPlan.id)).where(and_(*filters) if filters else True)
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        return items, total

    async def save_procedure(self, procedure: TreatmentProcedure) -> TreatmentProcedure:
        """Save a treatment procedure."""
        self.db.add(procedure)
        await self.db.flush()
        return procedure
