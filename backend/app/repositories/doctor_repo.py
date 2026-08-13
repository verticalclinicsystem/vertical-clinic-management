"""
Doctor repository — queries on the doctors and doctor_slots tables.
"""
from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.doctor import Doctor, DoctorSlot
from app.repositories.base import BaseRepository


class DoctorRepository(BaseRepository[Doctor]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Doctor, db)

    async def create(self, obj_in: dict) -> Doctor:
        if "user_id" in obj_in and obj_in.get("name") is None:
            from app.models.user import User
            user_res = await self.db.execute(select(User).where(User.id == obj_in["user_id"]))
            user_obj = user_res.scalar_one_or_none()
            if user_obj:
                obj_in["name"] = user_obj.full_name
        return await super().create(obj_in)

    async def get_by_user_id(self, user_id: uuid.UUID) -> Doctor | None:
        """Fetch doctor profile by associated user ID."""
        stmt = (
            select(Doctor)
            .options(joinedload(Doctor.user), joinedload(Doctor.slots), joinedload(Doctor.branch))
            .where(Doctor.user_id == user_id)
        )
        result = await self.db.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_doctor_with_relations(self, doctor_id: uuid.UUID) -> Doctor | None:
        """Fetch doctor profile with User, Slots, and Branch preloaded."""
        stmt = (
            select(Doctor)
            .options(joinedload(Doctor.user), joinedload(Doctor.slots), joinedload(Doctor.branch))
            .where(Doctor.id == doctor_id)
        )
        result = await self.db.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_slots(self, doctor_id: uuid.UUID) -> list[DoctorSlot]:
        """Fetch all weekly availability slots for a doctor."""
        stmt = (
            select(DoctorSlot)
            .where(DoctorSlot.doctor_id == doctor_id)
            .order_by(DoctorSlot.weekday, DoctorSlot.start_time)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def ensure_slots(self, doctor_id: uuid.UUID) -> list[DoctorSlot]:
        """Verify that a doctor has weekly availability slots. If not, generate and save defaults."""
        slots = await self.get_slots(doctor_id)
        if not slots:
            stmt = select(Doctor).where(Doctor.id == doctor_id)
            result = await self.db.execute(stmt)
            doctor = result.scalar_one_or_none()
            if not doctor:
                return []

            import json
            shift_start = "09:00"
            shift_end = "21:00"
            if doctor.availability_metadata:
                try:
                    meta = json.loads(doctor.availability_metadata)
                    shift_start = meta.get("shift_start", "09:00")
                    shift_end = meta.get("shift_end", "21:00")
                except Exception:
                    pass

            # Generate Monday (0) to Saturday (5)
            for w in range(6):
                slot = DoctorSlot(
                    id=uuid.uuid4(),
                    doctor_id=doctor_id,
                    weekday=w,
                    start_time=shift_start,
                    end_time=shift_end,
                    slot_duration_minutes=30,
                    is_active=True
                )
                self.db.add(slot)
                slots.append(slot)

            # Generate Sunday (6)
            slot_sun = DoctorSlot(
                id=uuid.uuid4(),
                doctor_id=doctor_id,
                weekday=6,
                start_time="09:00",
                end_time="14:00",
                slot_duration_minutes=30,
                is_active=True
            )
            self.db.add(slot_sun)
            slots.append(slot_sun)

            await self.db.flush()
            await self.db.commit()

        return slots

    async def save_slot(self, slot: DoctorSlot) -> DoctorSlot:
        """Save or update a weekly availability slot."""
        self.db.add(slot)
        await self.db.flush()
        return slot

    async def delete_slot(self, slot_id: uuid.UUID) -> None:
        """Delete a specific doctor availability slot."""
        stmt = select(DoctorSlot).where(DoctorSlot.id == slot_id)
        result = await self.db.execute(stmt)
        slot = result.scalar_one_or_none()
        if slot:
            await self.db.delete(slot)
            await self.db.flush()

    async def list_doctors_with_relations(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
        search: str | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[Doctor], int]:
        """Fetch filtered, paginated list of doctors with User and Slots loaded."""
        from app.models.user import User
        from sqlalchemy import func
        
        stmt = (
            select(Doctor)
            .options(joinedload(Doctor.user), joinedload(Doctor.slots), joinedload(Doctor.branch))
            .join(User, Doctor.user_id == User.id)
        )
        
        count_stmt = select(func.count(Doctor.id)).join(User, Doctor.user_id == User.id)
        
        filters = []
        if branch_id:
            filters.append(Doctor.branch_id == branch_id)
            
        if search:
            query = f"%{search.strip()}%"
            filters.append(
                User.full_name.ilike(query)
                | Doctor.specialization.ilike(query)
                | Doctor.qualification.ilike(query)
            )
            
        if filters:
            stmt = stmt.where(*filters)
            count_stmt = count_stmt.where(*filters)
            
        stmt = stmt.offset(skip).limit(limit)
        
        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())
        
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()
        
        return items, total
