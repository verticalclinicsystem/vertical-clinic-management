"""
Receptionist service — coordinates business logic for receptionist profiles.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy import select, func

from app.core.exceptions import BranchNotFoundError
from app.models.receptionist import Receptionist
from app.models.user import User
from app.repositories.receptionist_repo import ReceptionistRepository
from app.repositories.branch_repo import BranchRepository
from app.schemas.receptionist import ReceptionistUpdate, ReceptionistCreate

logger = logging.getLogger(__name__)


# Custom Exception to raise if Receptionist profile is not found
class ReceptionistNotFoundError(Exception):
    def __init__(self, message: str = "Receptionist profile not found."):
        self.message = message
        super().__init__(self.message)


class ReceptionistService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.receptionist_repo = ReceptionistRepository(db)
        self.branch_repo = BranchRepository(db)

    async def get_receptionist(self, recep_id: uuid.UUID) -> Receptionist:
        """Retrieve a receptionist profile by ID (with User loaded)."""
        stmt = (
            select(Receptionist)
            .options(joinedload(Receptionist.user), joinedload(Receptionist.branch))
            .where(Receptionist.id == recep_id)
        )
        result = await self.db.execute(stmt)
        receptionist = result.scalar_one_or_none()
        if not receptionist:
            raise ReceptionistNotFoundError()
        return receptionist

    async def get_receptionist_by_user_id(self, user_id: uuid.UUID) -> Receptionist:
        """Retrieve a receptionist profile by linked User ID."""
        stmt = (
            select(Receptionist)
            .options(joinedload(Receptionist.user), joinedload(Receptionist.branch))
            .where(Receptionist.user_id == user_id)
        )
        result = await self.db.execute(stmt)
        receptionist = result.scalar_one_or_none()
        if not receptionist:
            raise ReceptionistNotFoundError()
        return receptionist

    async def get_all_receptionists(
        self,
        *,
        page: int = 1,
        limit: int = 20,
        search: str | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[Receptionist], int]:
        """Get paginated, filtered, and searchable list of receptionists."""
        skip = (page - 1) * limit
        
        # Base query joining User to fetch name/phone details
        stmt = (
            select(Receptionist)
            .options(joinedload(Receptionist.user), joinedload(Receptionist.branch))
            .join(User, Receptionist.user_id == User.id)
        )
        
        count_stmt = select(func.count(Receptionist.id)).join(User, Receptionist.user_id == User.id)

        filters = []
        if branch_id:
            filters.append(Receptionist.branch_id == branch_id)
            
        if search:
            query = f"%{search.strip()}%"
            filters.append(
                User.full_name.ilike(query)
                | Receptionist.employee_id.ilike(query)
                | User.email.ilike(query)
            )

        if filters:
            stmt = stmt.where(*filters)
            count_stmt = count_stmt.where(*filters)

        # Execute pagination
        stmt = stmt.offset(skip).limit(limit)
        
        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())
        
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        return items, total

    async def create_receptionist_profile(self, request: ReceptionistCreate) -> Receptionist:
        """Create a receptionist profile linked to a User."""
        # Check if profile already exists
        existing = await self.receptionist_repo.get_by_user_id(request.user_id)
        if existing:
            return existing

        if request.branch_id:
            branch = await self.branch_repo.get_by_id(request.branch_id)
            if not branch:
                raise BranchNotFoundError()

        receptionist = await self.receptionist_repo.create_for_user(
            user_id=request.user_id,
            branch_id=request.branch_id,
            shift_start=request.shift_start,
            shift_end=request.shift_end,
            bio=request.bio,
        )
        await self.db.commit()
        logger.info(f"Receptionist profile created: {receptionist.id}")
        return await self.get_receptionist(receptionist.id)

    async def update_receptionist_profile(self, recep_id: uuid.UUID, request: ReceptionistUpdate) -> Receptionist:
        """Update receptionist shift hours, branch, etc."""
        receptionist = await self.get_receptionist(recep_id)
        update_data = request.model_dump(exclude_unset=True)

        if "branch_id" in update_data and update_data["branch_id"] is not None:
            branch = await self.branch_repo.get_by_id(update_data["branch_id"])
            if not branch:
                raise BranchNotFoundError()

        updated_receptionist = await self.receptionist_repo.update(receptionist, update_data)
        await self.db.commit()
        logger.info(f"Receptionist profile updated: {updated_receptionist.id}")
        return await self.get_receptionist(updated_receptionist.id)

    async def delete_receptionist_profile(self, recep_id: uuid.UUID) -> None:
        """Deactivate receptionist profile."""
        receptionist = await self.get_receptionist(recep_id)
        await self.receptionist_repo.update(receptionist, {"is_active": False})
        await self.db.commit()
        logger.info(f"Receptionist profile deactivated: {recep_id}")
