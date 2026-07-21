"""
MedicalReport repository — queries on the medical_reports table.
"""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medical_report import MedicalReport
from app.repositories.base import BaseRepository


class MedicalReportRepository(BaseRepository[MedicalReport]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(MedicalReport, db)

    async def get_by_patient_id(self, patient_id: uuid.UUID) -> list[MedicalReport]:
        """Fetch all medical reports for a specific patient."""
        result = await self.db.execute(
            select(MedicalReport)
            .where(MedicalReport.patient_id == patient_id)
            .order_by(MedicalReport.uploaded_at.desc())
        )
        return list(result.scalars().all())
