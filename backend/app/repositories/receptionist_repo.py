"""
Receptionist repository — queries on the receptionists table.
"""
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.receptionist import Receptionist
from app.models.user import User
from app.repositories.base import BaseRepository


class ReceptionistRepository(BaseRepository[Receptionist]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Receptionist, db)

    async def get_by_user_id(self, user_id: uuid.UUID) -> Receptionist | None:
        result = await self.db.execute(
            select(Receptionist)
            .options(joinedload(Receptionist.user), joinedload(Receptionist.branch))
            .where(Receptionist.user_id == user_id)
        )
        return result.unique().scalar_one_or_none()

    async def get_by_employee_id(self, emp_id: str) -> Receptionist | None:
        result = await self.db.execute(
            select(Receptionist)
            .options(joinedload(Receptionist.user), joinedload(Receptionist.branch))
            .where(Receptionist.employee_id == emp_id.upper().strip())
        )
        return result.unique().scalar_one_or_none()

    async def generate_employee_id(self) -> str:
        """Generate sequential employee code: RC-10001, RC-10002, ..."""
        result = await self.db.execute(
            select(func.count()).select_from(Receptionist)
        )
        count = result.scalar_one() or 0
        return f"RC-{10000 + count + 1}"

    async def create_for_user(
        self,
        user_id: uuid.UUID,
        branch_id: uuid.UUID | None = None,
        shift_start: str = "09:00",
        shift_end: str = "21:00",
        bio: str | None = None
    ) -> Receptionist:
        """Create receptionist profile linked to a user."""
        user_res = await self.db.execute(select(User).where(User.id == user_id))
        user_obj = user_res.scalar_one_or_none()
        name = user_obj.full_name if user_obj else None

        employee_id = await self.generate_employee_id()
        return await self.create({
            "user_id": user_id,
            "name": name,
            "employee_id": employee_id,
            "branch_id": branch_id,
            "shift_start": shift_start,
            "shift_end": shift_end,
            "bio": bio,
            "is_active": True,
        })

    async def search(self, query: str, skip: int = 0, limit: int = 20) -> list[Receptionist]:
        """Search receptionists by employee_id or name (via user join)."""
        result = await self.db.execute(
            select(Receptionist)
            .options(joinedload(Receptionist.user), joinedload(Receptionist.branch))
            .join(User, Receptionist.user_id == User.id)
            .where(
                User.full_name.ilike(f"%{query}%")
                | Receptionist.employee_id.ilike(f"%{query}%")
                | User.phone.ilike(f"%{query}%")
            )
            .offset(skip)
            .limit(limit)
        )
        return list(result.unique().scalars().all())

    async def count_search(self, query: str) -> int:
        """Count search matches."""
        result = await self.db.execute(
            select(func.count())
            .select_from(Receptionist)
            .join(User, Receptionist.user_id == User.id)
            .where(
                User.full_name.ilike(f"%{query}%")
                | Receptionist.employee_id.ilike(f"%{query}%")
                | User.phone.ilike(f"%{query}%")
            )
        )
        return result.scalar_one() or 0
