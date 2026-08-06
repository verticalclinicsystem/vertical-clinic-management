"""
Patient repository — queries on the patients table.
"""
import uuid

from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.repositories.base import BaseRepository


class PatientRepository(BaseRepository[Patient]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Patient, db)

    async def get_by_user_id(self, user_id: uuid.UUID) -> Patient | None:
        result = await self.db.execute(
            select(Patient).where(Patient.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_patient_code(self, code: str) -> Patient | None:
        result = await self.db.execute(
            select(Patient).where(Patient.patient_code == code.upper())
        )
        return result.scalar_one_or_none()

    async def generate_patient_code(self) -> str:
        """Generate sequential patient code: PT-10001, PT-10002, ..."""
        result = await self.db.execute(
            select(Patient.patient_code)
        )
        codes = result.scalars().all()
        max_num = 10000
        for code in codes:
            if code and code.startswith("PT-"):
                try:
                    num = int(code.split("-")[1])
                    if num > max_num:
                        max_num = num
                except (IndexError, ValueError):
                    pass
        return f"PT-{max_num + 1}"

    async def create_for_user(self, user_id: uuid.UUID) -> Patient:
        """
        Create a blank patient profile linked to the given user.
        Generates the next sequential patient code automatically.
        """
        from app.models.user import User
        user_res = await self.db.execute(select(User).where(User.id == user_id))
        user_obj = user_res.scalar_one_or_none()
        name = user_obj.full_name if user_obj else None

        patient_code = await self.generate_patient_code()
        return await self.create({
            "user_id": user_id,
            "name": name,
            "patient_code": patient_code,
        })

    async def get_patient_with_user(self, patient_id: uuid.UUID) -> Patient | None:
        """Fetch patient profile with user relation preloaded by patient ID."""
        stmt = (
            select(Patient)
            .options(joinedload(Patient.user))
            .where(Patient.id == patient_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_patient_by_user_id_with_user(self, user_id: uuid.UUID) -> Patient | None:
        """Fetch patient profile with user relation preloaded by user ID."""
        stmt = (
            select(Patient)
            .options(joinedload(Patient.user))
            .where(Patient.user_id == user_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_patient_by_code_with_user(self, code: str) -> Patient | None:
        """Fetch patient profile with user relation preloaded by patient code."""
        stmt = (
            select(Patient)
            .options(joinedload(Patient.user))
            .where(Patient.patient_code == code.upper().strip())
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_patients_with_user(self, skip: int = 0, limit: int = 20, search: str | None = None) -> list[Patient]:
        """Fetch list of patients with user relation preloaded, supporting search and pagination."""
        if search:
            from app.models.user import User
            query = search.strip()
            stmt = (
                select(Patient)
                .options(joinedload(Patient.user))
                .join(User, Patient.user_id == User.id)
                .where(
                    User.full_name.ilike(f"%{query}%")
                    | Patient.patient_code.ilike(f"%{query}%")
                    | User.phone.ilike(f"%{query}%")
                )
                .offset(skip)
                .limit(limit)
            )
        else:
            stmt = (
                select(Patient)
                .options(joinedload(Patient.user))
                .offset(skip)
                .limit(limit)
            )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


    async def search(self, query: str, skip: int = 0, limit: int = 20) -> list[Patient]:
        """Full-text search by patient_code or name (via user join)."""
        from app.models.user import User

        result = await self.db.execute(
            select(Patient)
            .join(User, Patient.user_id == User.id)
            .where(
                User.full_name.ilike(f"%{query}%")
                | Patient.patient_code.ilike(f"%{query}%")
                | User.phone.ilike(f"%{query}%")
            )
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_search(self, query: str) -> int:
        """Count full-text search matches by patient_code or name (via user join)."""
        from app.models.user import User

        result = await self.db.execute(
            select(func.count())
            .select_from(Patient)
            .join(User, Patient.user_id == User.id)
            .where(
                User.full_name.ilike(f"%{query}%")
                | Patient.patient_code.ilike(f"%{query}%")
                | User.phone.ilike(f"%{query}%")
            )
        )
        return result.scalar_one() or 0

