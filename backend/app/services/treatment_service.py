"""
Treatment service — business logic for patient clinical/therapy treatment plans.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DoctorNotFoundError, PatientNotFoundError, TreatmentPlanNotFoundError
from app.models.treatment import TreatmentPlan, TreatmentProcedure
from app.repositories.doctor_repo import DoctorRepository
from app.repositories.patient_repo import PatientRepository
from app.repositories.treatment_repo import TreatmentRepository
from app.schemas.treatment import TreatmentPlanCreate, TreatmentPlanUpdate

logger = logging.getLogger(__name__)


class TreatmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.treatment_repo = TreatmentRepository(db)
        self.doctor_repo = DoctorRepository(db)
        self.patient_repo = PatientRepository(db)

    async def create_treatment_plan(self, request: TreatmentPlanCreate) -> TreatmentPlan:
        """Create a new treatment plan with procedures."""
        # 1. Verify doctor and patient exist
        patient = await self.patient_repo.get_by_id(request.patient_id)
        if not patient:
            raise PatientNotFoundError()

        doctor = await self.doctor_repo.get_by_id(request.doctor_id)
        if not doctor:
            raise DoctorNotFoundError()

        # 2. Save treatment plan
        plan_data = {
            "patient_id": request.patient_id,
            "doctor_id": request.doctor_id,
            "title": request.title,
            "status": request.status,
            "total_cost": request.total_cost,
            "notes": request.notes,
        }
        created = await self.treatment_repo.create(plan_data)

        # 3. Save procedures
        for proc in request.procedures:
            procedure = TreatmentProcedure(
                treatment_plan_id=created.id,
                procedure_name=proc.procedure_name,
                cost=proc.cost,
                status=proc.status,
                notes=proc.notes,
            )
            await self.treatment_repo.save_procedure(procedure)

        await self.db.commit()
        logger.info(f"Treatment plan created: {created.id}")
        return await self.get_treatment_plan(created.id)

    async def get_treatment_plan(self, plan_id: uuid.UUID) -> TreatmentPlan:
        """Fetch details of a single treatment plan."""
        plan = await self.treatment_repo.get_treatment_plan_with_relations(plan_id)
        if not plan:
            raise TreatmentPlanNotFoundError()
        return plan

    async def list_treatment_plans(
        self,
        *,
        page: int = 1,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        doctor_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> tuple[list[TreatmentPlan], int]:
        """Fetch paginated, filtered list of treatment plans."""
        skip = (page - 1) * limit
        return await self.treatment_repo.get_treatment_plans_paginated(
            skip=skip,
            limit=limit,
            patient_id=patient_id,
            doctor_id=doctor_id,
            status=status,
        )

    async def update_treatment_plan(self, plan_id: uuid.UUID, request: TreatmentPlanUpdate) -> TreatmentPlan:
        """Update treatment plan metadata and procedures list."""
        plan = await self.get_treatment_plan(plan_id)
        if not plan:
            raise TreatmentPlanNotFoundError()

        if request.title is not None:
            plan.title = request.title
        if request.status is not None:
            plan.status = request.status
        if request.total_cost is not None:
            plan.total_cost = request.total_cost
        if request.notes is not None:
            plan.notes = request.notes

        if request.procedures is not None:
            # Delete old procedures
            stmt = delete(TreatmentProcedure).where(TreatmentProcedure.treatment_plan_id == plan_id)
            await self.db.execute(stmt)

            # Insert new procedures
            all_procs_completed = len(request.procedures) > 0 and all(p.status == "completed" for p in request.procedures)
            if all_procs_completed:
                plan.status = "completed"
            elif request.status is None:
                plan.status = "active"

            for proc in request.procedures:
                procedure = TreatmentProcedure(
                    treatment_plan_id=plan_id,
                    procedure_name=proc.procedure_name,
                    cost=proc.cost,
                    status=proc.status,
                    notes=proc.notes,
                )
                await self.treatment_repo.save_procedure(procedure)

        await self.db.commit()
        return await self.get_treatment_plan(plan_id)

