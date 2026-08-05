"""
Inventory repository — queries on the medicines and stock transactions tables.
"""
import uuid
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import Medicine, StockTransaction
from app.repositories.base import BaseRepository


class InventoryRepository(BaseRepository[Medicine]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Medicine, db)

    async def get_medicines_paginated(self, skip: int = 0, limit: int = 100) -> tuple[list[Medicine], int]:
        """Fetch all medicines paginated, ordered by name."""
        stmt = select(Medicine).order_by(Medicine.name).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())

        count_stmt = select(func.count(Medicine.id))
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        return items, total

    async def list_purchase_transactions(self, limit: int = 50) -> list[tuple[StockTransaction, Medicine]]:
        """Fetch stock transactions of type 'purchase' with their associated medicine."""
        stmt = (
            select(StockTransaction, Medicine)
            .join(Medicine, Medicine.id == StockTransaction.medicine_id)
            .where(StockTransaction.transaction_type == "purchase")
            .order_by(StockTransaction.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.all())
