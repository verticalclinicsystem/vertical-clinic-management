"""
Clinic Manager Service — handles staff onboarding (Doctors & Receptionists),
schedule change approvals, staff listing, and operational non-financial analytics.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, date, timedelta
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import (
    BadRequestError,
    BranchNotFoundError,
    EmailAlreadyExistsError,
    NotFoundError,
)
from app.core.security import hash_password
from app.models.availability_request import AvailabilityChangeRequest
from app.models.appointment import Appointment
from app.models.doctor import Doctor, DoctorSlot
from app.models.receptionist import Receptionist
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


class ClinicManagerService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def onboard_doctor(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
        phone: str | None = None,
        branch_id: uuid.UUID | None = None,
        specialization: str = "General Dentistry",
        qualification: str = "BDS",
        experience_years: int = 5,
        consultation_fee: float = 500.0,
        registration_number: str | None = None,
        tele_start: str = "15:00",
        tele_end: str = "17:00",
        lunch_start: str = "13:00",
        lunch_end: str = "14:00",
    ) -> dict[str, Any]:
        """Onboard a new Doctor: Create User + Doctor Profile + Default Slots."""
        # 1. Check existing email/phone
        stmt_user = select(User).where((User.email == email) | (User.phone == phone))
        res_user = await self.db.execute(stmt_user)
        if res_user.scalar_one_or_none():
            raise EmailAlreadyExistsError()

        # 2. Hash password & create User record
        hashed_pwd = hash_password(password)
        user = User(
            id=uuid.uuid4(),
            email=email,
            phone=phone,
            hashed_password=hashed_pwd,
            full_name=full_name,
            role=UserRole.DOCTOR,
            branch_id=branch_id,
            is_active=True,
            is_verified=True,
        )
        self.db.add(user)
        await self.db.flush()

        # 3. Create Doctor Profile
        avail_metadata = {
            "lunch_start": lunch_start,
            "lunch_end": lunch_end,
            "tele_start": tele_start,
            "tele_end": tele_end,
            "leaves": [],
        }

        doctor = Doctor(
            id=uuid.uuid4(),
            user_id=user.id,
            branch_id=branch_id,
            specialization=specialization,
            qualification=qualification,
            experience_years=experience_years,
            consultation_fee=consultation_fee,
            rating=4.8,
            registration_number=registration_number,
            is_available=True,
            availability_metadata=json.dumps(avail_metadata),
        )
        self.db.add(doctor)
        await self.db.flush()

        # 4. Create default weekly DoctorSlots (Mon-Sat: 09:00-13:00 and 14:00-21:00)
        for w in range(6):  # Monday (0) to Saturday (5)
            slot1 = DoctorSlot(
                id=uuid.uuid4(),
                doctor_id=doctor.id,
                weekday=w,
                start_time="09:00",
                end_time="13:00",
                slot_duration_minutes=30,
                is_active=True,
            )
            slot2 = DoctorSlot(
                id=uuid.uuid4(),
                doctor_id=doctor.id,
                weekday=w,
                start_time="14:00",
                end_time="21:00",
                slot_duration_minutes=30,
                is_active=True,
            )
            self.db.add_all([slot1, slot2])

        await self.db.commit()

        return {
            "doctor_id": str(doctor.id),
            "user_id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "specialization": doctor.specialization,
            "branch_id": str(branch_id) if branch_id else None,
            "message": f"Doctor {user.full_name} onboarded successfully.",
        }

    async def onboard_receptionist(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
        phone: str | None = None,
        branch_id: uuid.UUID | None = None,
        employee_code: str | None = None,
        shift_timing: str = "Morning Shift (09:00 - 17:00)",
    ) -> dict[str, Any]:
        """Onboard a new Receptionist: Create User + Receptionist Profile."""
        # 1. Check existing user
        stmt_user = select(User).where((User.email == email) | (User.phone == phone))
        res_user = await self.db.execute(stmt_user)
        if res_user.scalar_one_or_none():
            raise EmailAlreadyExistsError()

        hashed_pwd = hash_password(password)
        user = User(
            id=uuid.uuid4(),
            email=email,
            phone=phone,
            hashed_password=hashed_pwd,
            full_name=full_name,
            role=UserRole.RECEPTIONIST,
            branch_id=branch_id,
            is_active=True,
            is_verified=True,
        )
        self.db.add(user)
        await self.db.flush()

        code = employee_code or f"REC-{uuid.uuid4().hex[:6].upper()}"
        receptionist = Receptionist(
            id=uuid.uuid4(),
            user_id=user.id,
            branch_id=branch_id,
            employee_code=code,
            shift_timing=shift_timing,
            is_on_duty=True,
        )
        self.db.add(receptionist)
        await self.db.commit()

        return {
            "receptionist_id": str(receptionist.id),
            "user_id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "employee_code": code,
            "branch_id": str(branch_id) if branch_id else None,
            "message": f"Receptionist {user.full_name} onboarded successfully.",
        }

    async def get_branch_staff(self, branch_id: uuid.UUID | None = None) -> dict[str, Any]:
        """Get all doctors and receptionists assigned to a branch."""
        # Doctors
        doc_stmt = select(Doctor).options(joinedload(Doctor.user))
        if branch_id:
            doc_stmt = doc_stmt.where(Doctor.branch_id == branch_id)
        doc_res = await self.db.execute(doc_stmt)
        doctors = list(doc_res.scalars().all())

        # Receptionists
        rec_stmt = select(Receptionist).options(joinedload(Receptionist.user))
        if branch_id:
            rec_stmt = rec_stmt.where(Receptionist.branch_id == branch_id)
        rec_res = await self.db.execute(rec_stmt)
        receptionists = list(rec_res.scalars().all())

        return {
            "doctors": [
                {
                    "doctor_id": str(d.id),
                    "user_id": str(d.user_id),
                    "full_name": d.user.full_name if d.user else "N/A",
                    "email": d.user.email if d.user else "N/A",
                    "phone": d.user.phone if d.user else "N/A",
                    "specialization": d.specialization,
                    "consultation_fee": d.consultation_fee,
                    "is_available": d.is_available,
                }
                for d in doctors
            ],
            "receptionists": [
                {
                    "receptionist_id": str(r.id),
                    "user_id": str(r.user_id),
                    "full_name": r.user.full_name if r.user else "N/A",
                    "email": r.user.email if r.user else "N/A",
                    "phone": r.user.phone if r.user else "N/A",
                    "employee_code": r.employee_code,
                    "shift_timing": r.shift_timing,
                    "is_on_duty": r.is_on_duty,
                }
                for r in receptionists
            ],
        }

    async def get_schedule_requests(self, *, status: str | None = None) -> list[dict[str, Any]]:
        """List doctor availability and leave change requests."""
        stmt = select(AvailabilityChangeRequest).options(
            joinedload(AvailabilityChangeRequest.doctor).joinedload(Doctor.user)
        ).order_by(AvailabilityChangeRequest.created_at.desc())

        if status:
            stmt = stmt.where(AvailabilityChangeRequest.status == status)

        res = await self.db.execute(stmt)
        requests = list(res.scalars().all())

        out = []
        for req in requests:
            doc_name = req.doctor.user.full_name if req.doctor and req.doctor.user else "Doctor"
            out.append({
                "id": str(req.id),
                "doctor_id": str(req.doctor_id),
                "doctor_name": doc_name,
                "request_type": req.request_type,
                "status": req.status,
                "reason": req.reason,
                "proposed_start_date": req.proposed_start_date,
                "proposed_end_date": req.proposed_end_date,
                "proposed_start_time": req.proposed_start_time,
                "proposed_end_time": req.proposed_end_time,
                "response_notes": req.response_notes,
                "created_at": req.created_at.isoformat() if req.created_at else None,
            })
        return out

    async def review_schedule_request(
        self,
        request_id: uuid.UUID,
        *,
        action: str,  # "approve" or "reject"
        response_notes: str | None = None,
    ) -> dict[str, Any]:
        """Approve or reject a doctor's schedule change request."""
        stmt = select(AvailabilityChangeRequest).options(joinedload(AvailabilityChangeRequest.doctor)).where(AvailabilityChangeRequest.id == request_id)
        res = await self.db.execute(stmt)
        req = res.scalar_one_or_none()

        if not req:
            raise NotFoundError("Schedule change request not found.")

        if req.status != "pending":
            raise BadRequestError(f"Request is already {req.status}.")

        if action == "reject":
            req.status = "rejected"
            req.response_notes = response_notes or "Rejected by Clinic Manager."
            await self.db.commit()
            return {"id": str(req.id), "status": "rejected", "message": "Request rejected successfully."}

        # Approve logic
        req.status = "approved"
        req.response_notes = response_notes or "Approved by Clinic Manager."

        doctor = req.doctor
        if doctor and doctor.availability_metadata:
            meta: dict[str, Any] = {}
            if isinstance(doctor.availability_metadata, str):
                try:
                    parsed = json.loads(doctor.availability_metadata)
                    if isinstance(parsed, dict):
                        meta = parsed
                except Exception:
                    meta = {}

            if req.request_type == "leave" and req.proposed_start_date and req.proposed_end_date:
                existing_leaves = meta.get("leaves")
                leaves_list: list[dict[str, Any]] = list(existing_leaves) if isinstance(existing_leaves, list) else []
                leaves_list.append({"start_date": req.proposed_start_date, "end_date": req.proposed_end_date, "reason": req.reason or "Leave"})
                meta["leaves"] = leaves_list

            elif req.request_type == "lunch_break" and req.proposed_start_time and req.proposed_end_time:
                meta["lunch_start"] = req.proposed_start_time
                meta["lunch_end"] = req.proposed_end_time

            elif req.request_type == "teleconsultation" and req.proposed_start_time and req.proposed_end_time:
                meta["tele_start"] = req.proposed_start_time
                meta["tele_end"] = req.proposed_end_time

            doctor.availability_metadata = json.dumps(meta)

        await self.db.commit()
        return {"id": str(req.id), "status": "approved", "message": "Request approved and doctor availability updated."}

    async def get_operational_dashboard(self, branch_id: uuid.UUID | None = None) -> dict[str, Any]:
        """
        Compile operational non-financial dashboard statistics:
        - Appointments count today
        - Active doctors count
        - Waiting queue count
        - Pending schedule change requests
        """
        today_date = date.today()
        IST = timedelta(hours=5, minutes=30)
        today_start = datetime.combine(today_date, datetime.min.time()) - IST
        today_end = datetime.combine(today_date, datetime.max.time()) - IST

        # Appointments count today
        appt_stmt = select(func.count(Appointment.id)).where(
            Appointment.appointment_datetime >= today_start,
            Appointment.appointment_datetime <= today_end,
            Appointment.status.notin_(["cancelled", "rejected"]),
        )
        if branch_id:
            appt_stmt = appt_stmt.where(Appointment.branch_id == branch_id)
        appt_res = await self.db.execute(appt_stmt)
        today_appts_count = appt_res.scalar() or 0

        # Waiting queue count
        queue_stmt = select(func.count(Appointment.id)).where(
            Appointment.appointment_datetime >= today_start,
            Appointment.appointment_datetime <= today_end,
            Appointment.status.in_(["checked_in", "in_progress", "ready"]),
        )
        if branch_id:
            queue_stmt = queue_stmt.where(Appointment.branch_id == branch_id)
        queue_res = await self.db.execute(queue_stmt)
        waiting_queue_count = queue_res.scalar() or 0

        # Active doctors count
        doc_stmt = select(func.count(Doctor.id)).where(Doctor.is_available.is_(True))
        if branch_id:
            doc_stmt = doc_stmt.where(Doctor.branch_id == branch_id)
        doc_res = await self.db.execute(doc_stmt)
        active_doctors_count = doc_res.scalar() or 0

        # Pending schedule change requests count
        req_stmt = select(func.count(AvailabilityChangeRequest.id)).where(
            AvailabilityChangeRequest.status == "pending"
        )
        req_res = await self.db.execute(req_stmt)
        pending_requests_count = req_res.scalar() or 0

        return {
            "today_appointments_count": today_appts_count,
            "waiting_queue_count": waiting_queue_count,
            "active_doctors_count": active_doctors_count,
            "pending_schedule_requests_count": pending_requests_count,
            "operational_status": "Clinic Operations Running Smoothly",
        }
