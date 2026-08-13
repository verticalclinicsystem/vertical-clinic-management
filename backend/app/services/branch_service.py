"""
Branch service — coordinates business logic for branch operations and dashboards.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BranchNotFoundError, ConflictError
from app.models.branch import Branch
from app.models.doctor import Doctor
from app.models.inventory import Medicine
from app.models.patient import Patient
from app.models.user import User
from app.repositories.branch_repo import BranchRepository
from app.schemas.branch import BranchCreate, BranchUpdate

logger = logging.getLogger(__name__)


class BranchService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.branch_repo = BranchRepository(db)

    # ── CRUD Operations ───────────────────────────────────────────────────────

    async def create_branch(self, request: BranchCreate) -> Branch:
        """Create a new clinic branch after validating uniqueness of the code."""
        existing = await self.branch_repo.get_by_code(request.code)
        if existing:
            raise ConflictError(f"A branch with code '{request.code.upper()}' already exists.")

        branch_data = request.model_dump()
        branch_data["code"] = request.code.upper().strip()
        
        branch = await self.branch_repo.create(branch_data)
        await self.db.commit()
        logger.info(f"New branch created: {branch.name} ({branch.code})")
        return branch

    async def get_branch(self, branch_id: uuid.UUID) -> Branch:
        """Retrieve a branch by ID or raise BranchNotFoundError."""
        branch = await self.branch_repo.get_by_id(branch_id)
        if not branch:
            raise BranchNotFoundError()
        return branch

    async def get_all_branches(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[Branch], int]:
        """Get paginated, filtered, and searched list of branches."""
        skip = (page - 1) * limit
        return await self.branch_repo.get_branches_paginated(
            skip=skip,
            limit=limit,
            search=search,
            is_active=is_active,
        )

    async def update_branch(self, branch_id: uuid.UUID, request: BranchUpdate) -> Branch:
        """Update branch attributes, checking for code conflicts if updated."""
        branch = await self.get_branch(branch_id)
        update_data = request.model_dump(exclude_unset=True)

        if "code" in update_data and update_data["code"]:
            code_upper = update_data["code"].upper().strip()
            if code_upper != branch.code:
                existing = await self.branch_repo.get_by_code(code_upper)
                if existing:
                    raise ConflictError(f"A branch with code '{code_upper}' already exists.")
                update_data["code"] = code_upper

        updated_branch = await self.branch_repo.update(branch, update_data)
        await self.db.commit()
        logger.info(f"Branch updated: {updated_branch.code}")
        return updated_branch

    async def delete_branch(self, branch_id: uuid.UUID) -> Branch:
        """Soft delete a branch by setting is_active to False."""
        branch = await self.get_branch(branch_id)
        updated_branch = await self.branch_repo.update(branch, {"is_active": False})
        await self.db.commit()
        logger.info(f"Branch soft deleted (deactivated): {updated_branch.code}")
        return updated_branch

    async def activate_branch(self, branch_id: uuid.UUID) -> Branch:
        """Re-activate a previously deactivated branch."""
        branch = await self.get_branch(branch_id)
        updated_branch = await self.branch_repo.update(branch, {"is_active": True})
        await self.db.commit()
        logger.info(f"Branch activated: {updated_branch.code}")
        return updated_branch

    async def deactivate_branch(self, branch_id: uuid.UUID) -> Branch:
        """Deactivate a branch."""
        return await self.delete_branch(branch_id)

    # ── Branch Dashboard ──────────────────────────────────────────────────────

    async def get_branch_dashboard(self, branch_id: uuid.UUID) -> dict[str, Any]:
        """Fetch dashboard analytics for a specific branch."""
        branch = await self.get_branch(branch_id)

        # 1. Staff count (users mapped to this branch)
        staff_stmt = select(func.count(User.id)).where(User.branch_id == branch_id)
        staff_count = (await self.db.execute(staff_stmt)).scalar_one() or 0

        # 2. Doctor count
        doctor_stmt = select(func.count(Doctor.id)).where(Doctor.branch_id == branch_id)
        doctor_count = (await self.db.execute(doctor_stmt)).scalar_one() or 0

        # 3. Patients (preferred branch matches this branch)
        patient_stmt = select(func.count(Patient.id)).where(Patient.preferred_branch_id == branch_id)
        patient_count = (await self.db.execute(patient_stmt)).scalar_one() or 0

        # 4. Today's registered patients (preferred branch and registered today)
        today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
        today_patients_stmt = select(func.count(Patient.id)).where(
            Patient.preferred_branch_id == branch_id,
            Patient.created_at >= today_start
        )
        today_patients = (await self.db.execute(today_patients_stmt)).scalar_one() or 0

        # 5. Low stock items (Medicine inventory where stock <= reorder level)
        # Note: Medicine table is shared clinic-wide. We count low stock items overall.
        low_stock_stmt = select(func.count(Medicine.id)).where(Medicine.stock_qty <= Medicine.reorder_level)
        low_stock_items = (await self.db.execute(low_stock_stmt)).scalar_one() or 0

        # 6. Today's Appointments & Revenue
        from datetime import time as dt_time
        today_start = datetime.combine(date.today(), dt_time.min).replace(tzinfo=timezone.utc)
        today_end = datetime.combine(date.today(), dt_time.max).replace(tzinfo=timezone.utc)
        
        from app.models.appointment import Appointment
        from app.models.invoice import Invoice
        from app.models.consultation import Consultation

        today_appts_stmt = select(func.count(Appointment.id)).where(
            Appointment.branch_id == branch_id,
            Appointment.appointment_datetime >= today_start,
            Appointment.appointment_datetime <= today_end
        )
        today_appointments = (await self.db.execute(today_appts_stmt)).scalar_one() or 0

        today_revenue_stmt = select(func.coalesce(func.sum(Invoice.grand_total), 0)).join(
            Consultation, Consultation.id == Invoice.consultation_id
        ).where(
            Consultation.branch_id == branch_id,
            Invoice.created_at >= today_start,
            Invoice.created_at <= today_end
        )
        today_revenue = float((await self.db.execute(today_revenue_stmt)).scalar_one() or 0.0)

        return {
            "branch": branch.name,
            "today_appointments": today_appointments,
            "today_patients": today_patients,
            "doctor_count": doctor_count,
            "staff_count": staff_count,
            "today_revenue": today_revenue,
            "low_stock_items": low_stock_items,
        }

    # ── Associated Entities ───────────────────────────────────────────────────

    async def get_branch_staff(self, branch_id: uuid.UUID) -> list[User]:
        """Fetch all staff users linked to this branch (excl. patient role)."""
        await self.get_branch(branch_id)
        stmt = select(User).where(User.branch_id == branch_id, User.role != "patient")
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_branch_doctors(self, branch_id: uuid.UUID) -> list[Doctor]:
        """Fetch all doctors linked to this branch."""
        from sqlalchemy.orm import joinedload
        await self.get_branch(branch_id)
        stmt = (
            select(Doctor)
            .options(joinedload(Doctor.user), joinedload(Doctor.slots))
            .where(Doctor.branch_id == branch_id)
        )
        result = await self.db.execute(stmt)
        return list(result.unique().scalars().all())

    async def get_branch_patients(self, branch_id: uuid.UUID) -> list[Patient]:
        """Fetch all patients that preferred this branch."""
        from sqlalchemy.orm import joinedload
        await self.get_branch(branch_id)
        stmt = select(Patient).options(joinedload(Patient.user)).where(Patient.preferred_branch_id == branch_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_branch_appointments(self, branch_id: uuid.UUID) -> list[Appointment]:
        """Fetch all appointments for this branch."""
        await self.get_branch(branch_id)
        from app.models.appointment import Appointment
        stmt = select(Appointment).where(Appointment.branch_id == branch_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
