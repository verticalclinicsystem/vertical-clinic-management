"""
Payment repository — database queries on the payments table.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.payment import Payment
from app.repositories.base import BaseRepository


class PaymentRepository(BaseRepository[Payment]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Payment, db)

    async def get_payments_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        invoice_id: uuid.UUID | None = None,
    ) -> tuple[list[Payment], int]:
        """Fetch paginated & filtered payments."""
        filters = []
        if patient_id:
            filters.append(Payment.patient_id == patient_id)
        if invoice_id:
            filters.append(Payment.invoice_id == invoice_id)

        stmt = (
            select(Payment)
            .where(and_(*filters) if filters else True)
            .order_by(Payment.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())

        count_stmt = select(func.count(Payment.id)).where(and_(*filters) if filters else True)
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        return items, total

    async def get_next_payment_number(self) -> str:
        """Generate a sequential payment number: PAY-YYYYMMDD-XXXX."""
        today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        
        # Count payments created today
        stmt = select(func.count(Payment.id)).where(
            Payment.payment_number.like(f"PAY-{today_str}-%")
        )
        result = await self.db.execute(stmt)
        count = result.scalar_one()
        
        seq_num = count + 1
        return f"PAY-{today_str}-{seq_num:04d}"
