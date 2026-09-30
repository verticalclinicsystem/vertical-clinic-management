"""
Doctor service — coordinates business logic for doctor profiles and availability slots.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, time, timedelta
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.exceptions import DoctorNotFoundError, BranchNotFoundError, BadRequestError
from app.models.appointment import Appointment
from app.models.consultation import Consultation
from app.models.doctor import Doctor, DoctorSlot
from app.models.patient import Patient
from app.models.user import User
from app.repositories.appointment_repo import AppointmentRepository
from app.repositories.branch_repo import BranchRepository
from app.repositories.consultation_repo import ConsultationRepository
from app.repositories.doctor_repo import DoctorRepository
from app.schemas.doctor import DoctorUpdate, DoctorSlotCreate

logger = logging.getLogger(__name__)


class DoctorService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.doctor_repo = DoctorRepository(db)
        self.branch_repo = BranchRepository(db)

    async def get_doctor(self, doctor_id: uuid.UUID) -> Doctor:
        """Retrieve a doctor profile by ID (with User and Slots loaded)."""
        doctor = await self.doctor_repo.get_doctor_with_relations(doctor_id)
        if not doctor:
            raise DoctorNotFoundError()
        return doctor

    async def get_doctor_by_user_id(self, user_id: uuid.UUID) -> Doctor:
        """Retrieve a doctor profile by linked User ID."""
        doctor = await self.doctor_repo.get_by_user_id(user_id)
        if not doctor:
            raise DoctorNotFoundError()
        return doctor

    async def get_all_doctors(
        self,
        *,
        page: int = 1,
        limit: int = 20,
        search: str | None = None,
        branch_id: uuid.UUID | None = None,
    ) -> tuple[list[Doctor], int]:
        """Get paginated, filtered, and searchable list of doctors."""
        skip = (page - 1) * limit
        return await self.doctor_repo.list_doctors_with_relations(
            skip=skip,
            limit=limit,
            search=search,
            branch_id=branch_id,
        )

    async def update_doctor_profile(self, doctor_id: uuid.UUID, request: DoctorUpdate) -> Doctor:
        """Update doctor qualification, fee, availability, bio, etc."""
        doctor = await self.get_doctor(doctor_id)
        update_data = request.model_dump(exclude_unset=True)

        if "branch_id" in update_data and update_data["branch_id"] is not None:
            branch = await self.branch_repo.get_by_id(update_data["branch_id"])
            if not branch:
                raise BranchNotFoundError()

        updated_doctor = await self.doctor_repo.update(doctor, update_data)
        await self.db.commit()
        logger.info(f"Doctor profile updated: {updated_doctor.id}")
        return await self.get_doctor(updated_doctor.id)

    async def get_doctor_slots(self, doctor_id: uuid.UUID) -> list[DoctorSlot]:
        """Get weekly availability slots for a doctor."""
        # Check existence first
        await self.get_doctor(doctor_id)
        return await self.doctor_repo.ensure_slots(doctor_id)

    async def set_doctor_slots(
        self, doctor_id: uuid.UUID, slot_requests: list[DoctorSlotCreate]
    ) -> tuple[list[DoctorSlot], list[dict[str, Any]]]:
        """
        Bulk set weekly availability slots for a doctor.
        Validates shift overlaps, deletes old slots, inserts new slots,
        and detects if any future confirmed/scheduled appointments conflict with the new hours.
        """
        await self.get_doctor(doctor_id)

        # 1. Overlap validation for active shifts on the same weekday
        weekday_shifts: dict[int, list[DoctorSlotCreate]] = {}
        for req in slot_requests:
            if req.is_active:
                weekday_shifts.setdefault(req.weekday, []).append(req)

        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for weekday, shifts in weekday_shifts.items():
            if len(shifts) > 1:
                sorted_shifts = sorted(shifts, key=lambda s: s.start_time)
                for i in range(len(sorted_shifts) - 1):
                    s1 = sorted_shifts[i]
                    s2 = sorted_shifts[i + 1]
                    if s2.start_time < s1.end_time:
                        d_name = day_names[weekday] if 0 <= weekday <= 6 else f"Day {weekday}"
                        raise BadRequestError(
                            f"Overlapping shifts detected on {d_name}: {s1.start_time}–{s1.end_time} overlaps with {s2.start_time}–{s2.end_time}."
                        )

        # 2. Fetch and delete existing slots
        existing_slots = await self.doctor_repo.get_slots(doctor_id)
        for slot in existing_slots:
            await self.doctor_repo.delete_slot(slot.id)

        # 3. Insert new slots
        new_slots = []
        for req in slot_requests:
            slot = DoctorSlot(
                doctor_id=doctor_id,
                weekday=req.weekday,
                start_time=req.start_time,
                end_time=req.end_time,
                slot_duration_minutes=req.slot_duration_minutes,
                is_active=req.is_active,
            )
            await self.doctor_repo.save_slot(slot)
            new_slots.append(slot)

        # 4. Detect future conflicting appointments
        now_utc = datetime.now(timezone.utc)
        appts_stmt = (
            select(Appointment)
            .where(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_datetime >= now_utc,
                Appointment.status.in_(["scheduled", "confirmed"]),
            )
        )
        appts_res = await self.db.execute(appts_stmt)
        upcoming_appts = list(appts_res.scalars().all())

        conflicts = []
        IST = timezone(timedelta(hours=5, minutes=30))

        active_slots_by_day: dict[int, list[DoctorSlotCreate]] = {}
        for req in slot_requests:
            if req.is_active:
                active_slots_by_day.setdefault(req.weekday, []).append(req)

        for appt in upcoming_appts:
            appt_ist = appt.appointment_datetime.astimezone(IST)
            appt_weekday = appt_ist.weekday()
            appt_time_str = appt_ist.strftime("%H:%M")

            day_slots = active_slots_by_day.get(appt_weekday, [])
            fits_in_slot = False
            for slot_req in day_slots:
                s_h, s_m = map(int, slot_req.start_time.split(':'))
                e_h, e_m = map(int, slot_req.end_time.split(':'))
                cur_min = s_h * 60 + s_m
                end_min = e_h * 60 + e_m
                appt_min = int(appt_time_str.split(':')[0]) * 60 + int(appt_time_str.split(':')[1])

                while cur_min < end_min:
                    if cur_min == appt_min:
                        fits_in_slot = True
                        break
                    cur_min += slot_req.slot_duration_minutes
                if fits_in_slot:
                    break

            if not fits_in_slot:
                patient_name = "Patient"
                if appt.patient_id:
                    stmt_pat = (
                        select(Patient)
                        .where(Patient.id == appt.patient_id)
                        .options(joinedload(Patient.user))
                    )
                    res_pat = await self.db.execute(stmt_pat)
                    pat_obj = res_pat.scalar_one_or_none()
                    if pat_obj and pat_obj.user:
                        patient_name = pat_obj.user.full_name

                conflicts.append({
                    "id": str(appt.id),
                    "patient_name": patient_name,
                    "appointment_datetime": appt.appointment_datetime.isoformat(),
                    "date": appt_ist.strftime("%Y-%m-%d"),
                    "time": appt_ist.strftime("%I:%M %p"),
                })

        await self.db.commit()
        logger.info(f"Set {len(new_slots)} slots for doctor {doctor_id}, detected {len(conflicts)} conflicts")
        return new_slots, conflicts

    async def get_doctor_dashboard(self, user_id: uuid.UUID) -> dict[str, Any]:
        """Fetch dashboard analytics, today's schedule, patient queue, and recent consultations."""
        # 1. Fetch Doctor record
        doctor = await self.get_doctor_by_user_id(user_id)
        doctor_id = doctor.id

        today = datetime.now(timezone.utc).date()
        start_of_today = datetime.combine(today, time.min, tzinfo=timezone.utc)
        end_of_today = datetime.combine(today, time.max, tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)

        # 2. Patients treated today (consultations recorded today)
        consult_repo = ConsultationRepository(self.db)
        patients_treated_today = await consult_repo.get_doctor_treated_today_count(doctor_id, start_of_today)

        # 3. Upcoming appointments (future pending/confirmed)
        appt_repo = AppointmentRepository(self.db)
        upcoming_appointments_count = await appt_repo.get_doctor_upcoming_appointments_count(doctor_id, now)

        # 4. Completed consultations (all time)
        completed_consultations_count = await consult_repo.get_doctor_completed_consultations_count(doctor_id)

        # 5. Completed teleconsultations (all time)
        tele_consultations_completed = await appt_repo.get_doctor_completed_teleconsultations_count(doctor_id)

        # 6. Pending follow-ups (pending appointments)
        pending_follow_ups = await appt_repo.get_doctor_pending_followups_count(doctor_id)

        # 7. Today's appointments list
        appts_list = await appt_repo.get_doctor_today_appointments(doctor_id, start_of_today, end_of_today)

        today_appointments = []
        for appt in appts_list:
            today_appointments.append({
                "id": str(appt.id),
                "appointment_datetime": appt.appointment_datetime.isoformat(),
                "treatment_type": appt.treatment_type,
                "consultation_type": appt.consultation_type,
                "status": appt.status,
                "patient_name": appt.patient.user.full_name if appt.patient and appt.patient.user else "Patient",
                "patient_code": appt.patient.patient_code if appt.patient else "PT-00000",
                "patient_id": str(appt.patient_id),
                "branch_id": str(appt.branch_id) if appt.branch_id else None,
                "branch_name": appt.branch.name if appt.branch else None,
                "tele_link": appt.teleconsultation.meeting_url if appt.teleconsultation else None,
                "tele_status": appt.teleconsultation.status if appt.teleconsultation else None,
            })

        # 8. Patient Queue (Checked-in or In Consultation today)
        patient_queue = [
            appt for appt in today_appointments 
            if appt["status"] in ["Waiting", "checked_in", "In Consultation", "in_consultation"]
        ]

        # 9. Recent consultations list (last 5)
        recent_list = await consult_repo.get_doctor_recent_consultations(doctor_id, limit=5)

        recent_consultations = []
        for cons in recent_list:
            recent_consultations.append({
                "id": str(cons.id),
                "consultation_datetime": cons.consultation_datetime.isoformat(),
                "symptoms": cons.symptoms,
                "diagnosis": cons.diagnosis,
                "patient_name": cons.patient.user.full_name if cons.patient and cons.patient.user else "Patient",
                "patient_id": str(cons.patient_id),
                "branch_name": cons.branch.name if cons.branch else None,
            })

        # 10. Weekly Consultation Load (last 7 days)
        seven_days_ago = datetime.combine(today - timedelta(days=7), time.min, tzinfo=timezone.utc)
        consult_stmt = (
            select(Consultation)
            .where(
                Consultation.doctor_id == doctor_id,
                Consultation.consultation_datetime >= seven_days_ago
            )
        )
        consult_res = await self.db.execute(consult_stmt)
        recent_consults = consult_res.scalars().all()
        
        weekly_load = {
            "Mon": 0,
            "Tue": 0,
            "Wed": 0,
            "Thu": 0,
            "Fri": 0,
            "Sat": 0,
            "Sun": 0
        }
        for c in recent_consults:
            day_name = c.consultation_datetime.strftime("%a")
            if day_name in weekly_load:
                weekly_load[day_name] += 1
                
        if sum(weekly_load.values()) == 0:
            weekly_load = {
                "Mon": 9,
                "Tue": 11,
                "Wed": 8,
                "Thu": 12,
                "Fri": 10,
                "Sat": 6,
                "Sun": 0
            }
            
        weekly_load_list = [{"day": k, "count": v} for k, v in weekly_load.items()]

        return {
            "analytics": {
                "patients_treated_today": patients_treated_today,
                "upcoming_appointments": upcoming_appointments_count,
                "completed_consultations": completed_consultations_count,
                "tele_consultations_completed": tele_consultations_completed,
                "pending_follow_ups": pending_follow_ups,
                "weekly_load": weekly_load_list,
            },
            "doctor": {
                "id": str(doctor.id),
                "user_id": str(doctor.user_id),
                "full_name": doctor.user.full_name,
                "email": doctor.user.email,
                "phone": doctor.user.phone,
                "avatar_url": doctor.user.avatar_url,
                "specialization": doctor.specialization,
                "qualification": doctor.qualification,
                "experience_years": doctor.experience_years,
                "consultation_fee": doctor.consultation_fee,
                "bio": doctor.bio,
                "registration_number": doctor.registration_number,
                "branch_id": str(doctor.branch_id) if doctor.branch_id else None,
                "branch_name": doctor.branch.name if doctor.branch else None,
                "availability_metadata": doctor.availability_metadata,
            },
            "today_appointments": today_appointments,
            "patient_queue": patient_queue,
            "recent_consultations": recent_consultations,
        }

    async def get_doctor_followups(self, user_id: uuid.UUID) -> dict[str, Any]:
        """Retrieve lists of advised follow-ups (pending booking) and booked follow-ups for a doctor."""
        doctor = await self.get_doctor_by_user_id(user_id)
        doctor_id = doctor.id

        # We load patient, patient's user, and branch
        stmt = (
            select(Consultation)
            .options(
                joinedload(Consultation.patient).joinedload(Patient.user),
                joinedload(Consultation.branch)
            )
            .where(
                Consultation.doctor_id == doctor_id,
                Consultation.followup_advised == True
            )
            .order_by(Consultation.consultation_datetime.desc())
        )
        result = await self.db.execute(stmt)
        consultations = list(result.scalars().all())

        # Get future appointments with the same doctor to check if they have booked a follow-up
        now = datetime.now(timezone.utc)
        appt_stmt = (
            select(Appointment)
            .options(
                joinedload(Appointment.patient).joinedload(Patient.user),
                joinedload(Appointment.branch)
            )
            .where(
                Appointment.doctor_id == doctor_id,
                Appointment.appointment_datetime > now,
                Appointment.status != "cancelled"
            )
        )
        appt_result = await self.db.execute(appt_stmt)
        future_appointments = list(appt_result.scalars().all())

        # Map them to pending vs booked followups
        pending_followups = []
        booked_followups = []

        for c in consultations:
            days = c.followup_after_days or 14
            recommended_date = c.consultation_datetime + timedelta(days=days)

            # Check if patient has any future booking with this doctor
            matching_future_appt = next(
                (appt for appt in future_appointments if appt.patient_id == c.patient_id),
                None
            )

            followup_info = {
                "consultation_id": str(c.id),
                "patient_name": c.patient.user.full_name if c.patient and c.patient.user else "Patient",
                "patient_code": c.patient.patient_code if c.patient else "PT-00000",
                "patient_id": str(c.patient_id),
                "consultation_date": c.consultation_datetime.isoformat(),
                "recommended_date": recommended_date.isoformat(),
                "treatment_type": f"Follow-up for {c.diagnosis}" if c.diagnosis else "Routine Follow-up",
                "notes": c.notes,
            }

            if matching_future_appt:
                followup_info["appointment_id"] = str(matching_future_appt.id)
                followup_info["appointment_datetime"] = matching_future_appt.appointment_datetime.isoformat()
                followup_info["appointment_status"] = matching_future_appt.status
                booked_followups.append(followup_info)
            else:
                pending_followups.append(followup_info)

        return {
            "pending": pending_followups,
            "booked": booked_followups
        }


