"""
Teleconsultation repository — database queries for teleconsultation video meetings.
"""
import uuid
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.teleconsult import TeleConsultation
from app.repositories.base import BaseRepository


class TeleConsultRepository(BaseRepository[TeleConsultation]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(TeleConsultation, db)

    async def get_by_appointment_id(self, appointment_id: uuid.UUID) -> TeleConsultation | None:
        """Fetch teleconsultation by appointment ID."""
        stmt = select(TeleConsultation).where(TeleConsultation.appointment_id == appointment_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
