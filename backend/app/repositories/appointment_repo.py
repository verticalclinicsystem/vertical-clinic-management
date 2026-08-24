"""
Appointment repository — database queries on the appointments table.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.repositories.base import BaseRepository


class AppointmentRepository(BaseRepository[Appointment]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Appointment, db)

    async def get_appointment_with_relations(self, appointment_id: uuid.UUID) -> Appointment | None:
        """Fetch single appointment with patient, doctor, and branch eager loaded."""
        stmt = (
            select(Appointment)
            .options(
                joinedload(Appointment.patient).joinedload(Patient.user),
                joinedload(Appointment.doctor).joinedload(Doctor.user),
                joinedload(Appointment.doctor).selectinload(Doctor.slots),
                joinedload(Appointment.branch)
            )
            .where(Appointment.id == appointment_id)
        )
        result = await self.db.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_appointments_paginated(
        self,
        *,
        skip: int = 0,
        limit: int = 20,
        patient_id: uuid.UUID | None = None,
        doctor_id: uuid.UUID | None = None,
        branch_id: uuid.UUID | None = None,
        status: str | None = None,
        rescheduled: bool | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        search: str | None = None,
    ) -> tuple[list[Appointment], int]:
        """Fetch paginated, filtered appointments."""
        filters = []
        if patient_id:
            filters.append(Appointment.patient_id == patient_id)
        if doctor_id:
            filters.append(Appointment.doctor_id == doctor_id)
        if branch_id:
            filters.append(Appointment.branch_id == branch_id)
        
        if status:
            now_utc = datetime.now(timezone.utc)
            if status == "upcoming":
                filters.append(Appointment.status.in_(["pending", "confirmed", "checked_in", "Waiting", "in_consultation"]))
                filters.append(Appointment.appointment_datetime >= now_utc)
            elif status == "cancelled":
                filters.append(Appointment.status.in_(["cancelled", "rejected"]))
            elif status == "completed":
                filters.append(Appointment.status == "completed")
            elif status == "history":
                filters.append(
                    or_(
                        Appointment.status.in_(["completed", "cancelled", "rejected"]),
                        Appointment.appointment_datetime < now_utc
                    )
                )
            else:
                filters.append(Appointment.status == status)

        if rescheduled is True:
            filters.append(Appointment.reschedule_count > 0)
        elif rescheduled is False:
            filters.append(Appointment.reschedule_count == 0)

        if start_date:
            filters.append(Appointment.appointment_datetime >= start_date)
        if end_date:
            filters.append(Appointment.appointment_datetime <= end_date)

        # Base statement
        stmt = (
            select(Appointment)
            .options(
                joinedload(Appointment.patient).joinedload(Patient.user),
                joinedload(Appointment.doctor).joinedload(Doctor.user),
                joinedload(Appointment.branch)
            )
        )
        
        count_stmt = select(func.count(Appointment.id))

        if search:
            # Join Doctor and User to filter on doctor's name or treatment type
            stmt = stmt.join(Doctor, Appointment.doctor_id == Doctor.id).join(User, Doctor.user_id == User.id)
            count_stmt = count_stmt.join(Doctor, Appointment.doctor_id == Doctor.id).join(User, Doctor.user_id == User.id)
            filters.append(
                Appointment.treatment_type.ilike(f"%{search}%") |
                User.full_name.ilike(f"%{search}%")
            )

        stmt = stmt.where(and_(*filters) if filters else True)
        count_stmt = count_stmt.where(and_(*filters) if filters else True)

        stmt = stmt.order_by(Appointment.appointment_datetime.desc()).offset(skip).limit(limit)

        result = await self.db.execute(stmt)
        items = list(result.unique().scalars().all())

        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        return items, total

    async def get_upcoming_patient_appointments(self, patient_id: uuid.UUID, now: datetime) -> list[Appointment]:
        """Fetch upcoming pending/confirmed appointments for a patient."""
        stmt = (
            select(Appointment)
            .options(
                joinedload(Appointment.doctor).joinedload(Doctor.user),
                joinedload(Appointment.branch)
            )
            .where(
                Appointment.patient_id == patient_id,
                Appointment.status.in_(["pending", "confirmed"]),
                Appointment.appointment_datetime >= now
            )
            .order_by(Appointment.appointment_datetime.asc())
        )
        res = await self.db.execute(stmt)
        return list(res.unique().scalars().all())

    async def get_doctor_upcoming_appointments_count(self, doctor_id: uuid.UUID, now: datetime) -> int:
        """Fetch total upcoming appointments count for a doctor."""
        stmt = select(func.count(Appointment.id)).where(
            Appointment.doctor_id == doctor_id,
            Appointment.status.in_(["pending", "confirmed"]),
            Appointment.appointment_datetime >= now
        )
        res = await self.db.execute(stmt)
        return res.scalar_one() or 0

    async def get_doctor_completed_teleconsultations_count(self, doctor_id: uuid.UUID) -> int:
        """Fetch completed teleconsultations count for a doctor."""
        stmt = select(func.count(Appointment.id)).where(
            Appointment.doctor_id == doctor_id,
            Appointment.consultation_type == "teleconsultation",
            Appointment.status == "completed"
        )
        res = await self.db.execute(stmt)
        return res.scalar_one() or 0

    async def get_doctor_pending_followups_count(self, doctor_id: uuid.UUID) -> int:
        """Fetch count of pending appointments for follow-up."""
        stmt = select(func.count(Appointment.id)).where(
            Appointment.doctor_id == doctor_id,
            Appointment.status == "pending"
        )
        res = await self.db.execute(stmt)
        return res.scalar_one() or 0

    async def get_doctor_today_appointments(self, doctor_id: uuid.UUID, start_of_today: datetime, end_of_today: datetime) -> list[Appointment]:
        """Fetch today's appointments list for a doctor."""
        stmt = (
            select(Appointment)
            .options(
                joinedload(Appointment.patient).joinedload(Patient.user),
                joinedload(Appointment.branch),
                joinedload(Appointment.teleconsultation)
            )
            .where(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_datetime >= start_of_today,
                Appointment.appointment_datetime <= end_of_today
            )
            .order_by(Appointment.appointment_datetime.asc())
        )
        res = await self.db.execute(stmt)
        return list(res.unique().scalars().all())

