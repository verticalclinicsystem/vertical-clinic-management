"""
Branch repository — queries on the branches table.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import Branch
from app.repositories.base import BaseRepository


class BranchRepository(BaseRepository[Branch]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Branch, db)

    async def get_by_code(self, code: str) -> Branch | None:
        result = await self.db.execute(
            select(Branch).where(Branch.code == code.upper())
        )
        return result.scalar_one_or_none()

    async def get_active_branches(self) -> list[Branch]:
        result = await self.db.execute(
            select(Branch).where(Branch.is_active == True)  # noqa: E712
            .order_by(Branch.name)
        )
        return list(result.scalars().all())

    async def get_branches_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 10,
        search: str | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[Branch], int]:
        """Fetch a paginated list of branches with searching and status filtering."""
        filters = []
        if is_active is not None:
            filters.append(Branch.is_active == is_active)
        if search:
            search_pattern = f"%{search.strip()}%"
            filters.append(
                (Branch.name.ilike(search_pattern)) |
                (Branch.code.ilike(search_pattern)) |
                (Branch.city.ilike(search_pattern)) |
                (Branch.address.ilike(search_pattern))
            )

        items = await self.get_all(
            skip=skip,
            limit=limit,
            filters=filters,
            order_by=Branch.name,
        )
        total = await self.count(filters=filters)
        return items, total

