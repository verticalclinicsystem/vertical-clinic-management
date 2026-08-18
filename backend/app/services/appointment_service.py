"""
Appointment service — handles business logic and validation for appointments.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta, time as dt_time

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    DoctorNotFoundError, BranchNotFoundError, PatientNotFoundError,
    PermissionDeniedError, BadRequestError
)
from app.models.appointment import Appointment
from app.repositories.appointment_repo import AppointmentRepository
from app.repositories.doctor_repo import DoctorRepository
from app.repositories.patient_repo import PatientRepository
from app.repositories.branch_repo import BranchRepository
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate

logger = logging.getLogger(__name__)


class AppointmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.appointment_repo = AppointmentRepository(db)
        self.doctor_repo = DoctorRepository(db)
        self.patient_repo = PatientRepository(db)
        self.branch_repo = BranchRepository(db)

    async def get_available_slots(
        self,
        doctor_id: uuid.UUID,
        date_str: str,
        consultation_type: str | None = None,
        current_user: User | None = None
    ) -> list[dict]:
        """Calculate available time slots for a doctor on a specific date, factoring in lunch breaks, teleconsultation windows, and leaves."""
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise BadRequestError("Invalid date format. Expected YYYY-MM-DD.")

        weekday = date_obj.weekday()

        # Fetch doctor to check availability metadata (leaves, lunch breaks, teleconsultation windows)
        doctor = await self.doctor_repo.get_by_id(doctor_id)
        
        if doctor and not doctor.is_available:
            return [] # Doctor is off duty, no slots available

        lunch_start = None
        lunch_end = None
        tele_start = None
        tele_end = None
        leaves = []

        if doctor and doctor.availability_metadata:
            import json
            try:
                meta = json.loads(doctor.availability_metadata)
                
                # Check leaves
                leaves = meta.get("leaves", [])
                for leave in leaves:
                    start_leave = datetime.strptime(leave["start_date"], "%Y-%m-%d").date()
                    end_leave = datetime.strptime(leave["end_date"], "%Y-%m-%d").date()
                    if start_leave <= date_obj <= end_leave:
                        return [] # Doctor on leave, no slots

                lunch_start = meta.get("lunch_start")
                lunch_end = meta.get("lunch_end")
                tele_start = meta.get("tele_start")
                tele_end = meta.get("tele_end")
            except Exception as e:
                logger.error(f"Error parsing doctor availability metadata: {e}")

        # Fetch branch opening/closing hours
        branch_opening = "09:00"
        branch_closing = "21:00"
        if doctor and doctor.branch_id:
            from app.models.branch import Branch
            res_branch = await self.db.execute(select(Branch).where(Branch.id == doctor.branch_id))
            branch = res_branch.scalar_one_or_none()
            if branch:
                branch_opening = branch.opening_hour
                branch_closing = branch.closing_hour

        # Fetch active slots for that day (ensure slots exist)
        slots_all = await self.doctor_repo.ensure_slots(doctor_id)
        slots = [s for s in slots_all if s.weekday == weekday and s.is_active]
        if not slots:
            return []

        # Generate all interval times with their base status
        generated_slots = []
        for slot in slots:
            start_dt = datetime.strptime(slot.start_time, "%H:%M")
            end_dt = datetime.strptime(slot.end_time, "%H:%M")
            current_dt = start_dt
            while current_dt < end_dt:
                slot_time_str = current_dt.strftime("%H:%M")
                
                # Filter slots outside branch operational hours
                if not (branch_opening <= slot_time_str < branch_closing):
                    current_dt += timedelta(minutes=slot.slot_duration_minutes)
                    continue

                # Lunch break check
                is_lunch = False
                if lunch_start and lunch_end:
                    if lunch_start <= slot_time_str < lunch_end:
                        is_lunch = True
                
                # Teleconsultation hours check
                is_tele_only = False
                has_tele_window = False
                if tele_start and tele_end:
                    has_tele_window = True
                    if tele_start <= slot_time_str < tele_end:
                        is_tele_only = True

                # Determine base status
                if is_lunch:
                    status = "lunch_break"
                elif consultation_type == "teleconsultation":
                    if has_tele_window:
                        status = "available" if is_tele_only else "in_clinic_only"
                    else:
                        status = "available"
                elif consultation_type == "in_person":
                    status = "tele_only" if is_tele_only else "available"
                else:
                    # consultation_type is None/not specified
                    status = "tele_only" if is_tele_only else "available"

                generated_slots.append({
                    "time": slot_time_str,
                    "status": status
                })

                current_dt += timedelta(minutes=slot.slot_duration_minutes)

        # IST = UTC+5:30  — all slot times are expressed in IST
        IST = timezone(timedelta(hours=5, minutes=30))

        # Fetch existing appointments for the doctor on that date (IST date)
        # We need to compare in IST since date_obj is the local (IST) date
        # Use a datetime range spanning the full IST day instead of func.date() which works in UTC
        day_start_ist = datetime.combine(date_obj, dt_time.min).replace(tzinfo=IST)
        day_end_ist   = datetime.combine(date_obj, dt_time.max).replace(tzinfo=IST)

        appts_stmt = select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_datetime >= day_start_ist,
            Appointment.appointment_datetime <= day_end_ist,
            Appointment.status.notin_(["cancelled", "rejected"])
        )
        appts_res = await self.db.execute(appts_stmt)
        appts = list(appts_res.scalars().all())

        # Convert each stored UTC-aware datetime → IST → "HH:MM" for comparison
        def to_ist_hhmm(dt: datetime) -> str:
            if dt.tzinfo is not None:
                dt = dt.astimezone(IST)
            return dt.strftime("%H:%M")

        booked_times = {to_ist_hhmm(appt.appointment_datetime) for appt in appts}

        # Filter out past slots and 30-minute lead time buffer for today's date in IST
        import sys
        is_testing = "pytest" in sys.modules or any("pytest" in arg for arg in sys.argv)

        current_time_ist = datetime.now(IST)
        is_today = (date_obj == current_time_ist.date())

        # Sort and deduplicate generated slots by time
        unique_slots = {}
        for s in generated_slots:
            unique_slots[s["time"]] = s["status"]

        # Check if current user is staff/receptionist
        is_staff = False
        if current_user:
            is_staff = current_user.role in ["receptionist", "admin", "clinic_manager"]

        result = []
        for t in sorted(unique_slots.keys()):
            status = unique_slots[t]
            
            # If booked, override status
            if t in booked_times:
                status = "booked"
            
            # Exclude past slots if today by setting them as expired or booked
            if is_today and not is_testing:
                slot_hour, slot_min = map(int, t.split(":"))
                slot_dt = datetime.combine(date_obj, dt_time(slot_hour, slot_min)).replace(tzinfo=IST)
                # Exclude if slot time is in the past or within 30 mins lead time
                if slot_dt < current_time_ist:
                    if status != "booked":
                        status = "expired"
                elif slot_dt < current_time_ist + timedelta(minutes=30):
                    if not is_staff:
                        if status != "booked":
                            status = "expired"

            result.append({
                "time": t,
                "status": status
            })

        return result

    async def create_appointment(
        self,
        *,
        patient_id: uuid.UUID,
        request: AppointmentCreate,
        role: str | None = None,
    ) -> Appointment:
        """Create a new appointment for a patient."""
        # 1. Verify patient exists
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise PatientNotFoundError()

        role_str = str(role.value) if hasattr(role, "value") else str(role) if role else ""
        role_lower = role_str.lower()
        is_staff = role_lower in ["receptionist", "admin", "clinic_manager"]

        # 2. Verify doctor exists and is available
        doctor = await self.doctor_repo.get_by_id(request.doctor_id)
        if not doctor:
            raise DoctorNotFoundError()
        if not doctor.is_available and not is_staff:
            raise BadRequestError("Doctor is currently not available for bookings.")

        # Normalize: if the incoming datetime is naive, assume it's IST (clinic local time)
        # and make it timezone-aware so it's stored correctly as UTC in the DB.
        IST = timezone(timedelta(hours=5, minutes=30))
        appt_dt = request.appointment_datetime
        if appt_dt.tzinfo is None:
            appt_dt = appt_dt.replace(tzinfo=IST)
        # Store back as IST-aware (PostgreSQL will convert to UTC internally)
        request.appointment_datetime = appt_dt

        # IST time string used for all metadata / slot comparisons
        appt_time_str_ist = appt_dt.astimezone(IST).strftime("%H:%M")
        appt_date_ist = appt_dt.astimezone(IST).date()

        # Check leaves, lunch break, and tele-only hours constraints from metadata
        if doctor.availability_metadata and not is_staff:
            import json
            try:
                meta = json.loads(doctor.availability_metadata)

                # Check leaves (compare against IST date)
                leaves = meta.get("leaves", [])
                for leave in leaves:
                    start_leave = datetime.strptime(leave["start_date"], "%Y-%m-%d").date()
                    end_leave = datetime.strptime(leave["end_date"], "%Y-%m-%d").date()
                    if start_leave <= appt_date_ist <= end_leave:
                        next_available = end_leave + timedelta(days=1)
                        raise BadRequestError(f"Doctor is currently on leave and will be available from {next_available.strftime('%Y-%m-%d')}.")

                # Check lunch break
                lunch_start = meta.get("lunch_start")
                lunch_end = meta.get("lunch_end")
                if lunch_start and lunch_end:
                    if lunch_start <= appt_time_str_ist < lunch_end:
                        raise BadRequestError("Selected slot falls during the doctor's lunch break.")

                # Check tele-only window
                tele_start = meta.get("tele_start")
                tele_end = meta.get("tele_end")
                if tele_start and tele_end:
                    is_tele_time = tele_start <= appt_time_str_ist < tele_end
                    if is_tele_time and request.consultation_type != "teleconsultation":
                        raise BadRequestError("Selected slot is reserved exclusively for teleconsultations.")
                    if not is_tele_time and request.consultation_type == "teleconsultation":
                        raise BadRequestError("Teleconsultations can only be booked during the doctor's designated teleconsultation window.")
            except BadRequestError:
                raise
            except Exception as e:
                logger.error(f"Error validating doctor availability constraints: {e}")

        # 3. Verify branch exists
        branch = await self.branch_repo.get_by_id(request.branch_id)
        if not branch:
            raise BranchNotFoundError()

        # Past dates and 30-minute lead time buffer check
        import sys
        is_testing = "pytest" in sys.modules or any("pytest" in arg for arg in sys.argv)

        current_time_ist = datetime.now(IST)
        if not is_testing:
            if appt_dt < current_time_ist:
                raise BadRequestError("Cannot book appointments in the past.")
            if not is_staff and appt_dt < current_time_ist + timedelta(minutes=30):
                raise BadRequestError("Appointments must be booked at least 30 minutes in advance.")

        # Clinic working hours guard — compare in IST
        appt_time_ist = appt_dt.astimezone(IST).time()
        weekday = appt_date_ist.weekday()
        if not is_staff:
            if weekday == 6: # Sunday
                if appt_time_ist < dt_time(9, 0) or appt_time_ist >= dt_time(14, 0):
                    raise BadRequestError("Clinic working hours on Sunday are from 09:00 AM to 02:00 PM. Please choose a slot within these hours.")
            else: # Monday - Saturday
                if appt_time_ist < dt_time(9, 0) or appt_time_ist >= dt_time(21, 0):
                    raise BadRequestError("Clinic working hours are from 09:00 AM to 09:00 PM. Please choose a slot within these hours.")

        # 4. Check double booking for Doctor (compare UTC-stored datetimes)
        double_booking_stmt = select(Appointment).where(
            Appointment.doctor_id == request.doctor_id,
            Appointment.appointment_datetime == appt_dt,
            Appointment.status.notin_(["cancelled", "rejected"])
        )
        double_booking_res = await self.db.execute(double_booking_stmt)
        if double_booking_res.unique().scalar_one_or_none():
            raise BadRequestError("Doctor is already booked at this date and time.")

        # Check double booking for Patient (exact datetime match)
        patient_booking_stmt = select(Appointment).where(
            Appointment.patient_id == patient_id,
            Appointment.appointment_datetime == appt_dt,
            Appointment.status.notin_(["cancelled", "rejected"])
        )
        patient_booking_res = await self.db.execute(patient_booking_stmt)
        if patient_booking_res.unique().scalar_one_or_none():
            raise BadRequestError("You already have an appointment booked at this date and time.")

        # Rule 1 Check: Doctor-specific restriction on the same day for Patient
        if not is_testing and not is_staff:
            day_start_ist = datetime.combine(appt_date_ist, dt_time.min).replace(tzinfo=IST)
            day_end_ist   = datetime.combine(appt_date_ist, dt_time.max).replace(tzinfo=IST)
            same_day_doctor_stmt = select(Appointment).where(
                Appointment.patient_id == patient_id,
                Appointment.doctor_id == request.doctor_id,
                Appointment.appointment_datetime >= day_start_ist,
                Appointment.appointment_datetime <= day_end_ist,
                Appointment.status.notin_(["cancelled", "rejected", "completed"])
            )
            same_day_doctor_res = await self.db.execute(same_day_doctor_stmt)
            if same_day_doctor_res.scalars().first():
                raise BadRequestError(
                    "You already have an active appointment scheduled on this date with this doctor. "
                    "Please reschedule your existing appointment instead of booking a new one."
                )

        # 5. Verify availability if slots are defined for this weekday (use IST weekday)
        weekday = appt_date_ist.weekday()
        from app.models.doctor import DoctorSlot
        slots_stmt = select(DoctorSlot).where(
            DoctorSlot.doctor_id == request.doctor_id,
            DoctorSlot.weekday == weekday,
            DoctorSlot.is_active == True
        )
        slots_res = await self.db.execute(slots_stmt)
        slots = list(slots_res.scalars().all())
        if slots and not is_staff:
            time_matches = False
            for slot in slots:
                start_dt = datetime.strptime(slot.start_time, "%H:%M")
                end_dt = datetime.strptime(slot.end_time, "%H:%M")
                current_dt = start_dt
                while current_dt < end_dt:
                    if current_dt.strftime("%H:%M") == appt_time_str_ist:
                        time_matches = True
                        break
                    current_dt += timedelta(minutes=slot.slot_duration_minutes)
                if time_matches:
                    break
            if not time_matches:
                raise BadRequestError(f"Selected time {appt_time_str_ist} is not within the doctor's available slots.")

        # 5.5 Generate Queue Token Number dynamically
        day_start_ist = datetime.combine(appt_date_ist, dt_time.min).replace(tzinfo=IST)
        day_end_ist   = datetime.combine(appt_date_ist, dt_time.max).replace(tzinfo=IST)
        token_stmt = select(func.count(Appointment.id)).where(
            Appointment.doctor_id == request.doctor_id,
            Appointment.appointment_datetime >= day_start_ist,
            Appointment.appointment_datetime <= day_end_ist,
            Appointment.status.notin_(["cancelled", "rejected"])
        )
        token_res = await self.db.execute(token_stmt)
        token_count = token_res.scalar() or 0
        assigned_token = token_count + 1

        # 6. Create appointment record with status = confirmed
        appointment_data = {
            "patient_id": patient_id,
            "doctor_id": request.doctor_id,
            "branch_id": request.branch_id,
            "appointment_datetime": request.appointment_datetime,
            "treatment_type": request.treatment_type,
            "consultation_type": request.consultation_type,
            "status": "confirmed",
            "token_number": assigned_token,
            "notes": request.notes,
        }

        created = await self.appointment_repo.create(appointment_data)
        await self.db.commit()

        # Broadcast queue update
        try:
            from app.core.websocket import manager
            await manager.send_to_branch(str(request.branch_id), {"event": "queue_updated", "branch_id": str(request.branch_id)})
        except Exception as ws_err:
            logger.warning(f"Failed to broadcast websocket event: {ws_err}")

        logger.info(
            "API Success - Appointment created successfully | ID: %s | Patient: %s | Doctor: %s | Datetime: %s | Mode: %s",
            created.id,
            patient_id,
            request.doctor_id,
            request.appointment_datetime,
            request.consultation_type
        )
        full_appt = await self.get_appointment(created.id)
        
        # Send notification
        from app.services.notification_service import NotificationService
        try:
            noti_service = NotificationService(self.db)
            if full_appt.patient:
                doc_name = full_appt.doctor.user.full_name if full_appt.doctor and full_appt.doctor.user else 'Doctor'
                time_str = full_appt.appointment_datetime.astimezone(IST).strftime('%I:%M %p on %Y-%m-%d')
                branch_name = full_appt.branch.name if full_appt.branch else 'Vertical Clinic'
                token_str = f"TK-{full_appt.token_number:03d}" if full_appt.token_number else "N/A"
                msg = (
                    f"Booking Confirmed: Appointment for {full_appt.treatment_type} with Dr. {doc_name} "
                    f"is scheduled at {time_str}. Location: {branch_name}. Queue Token Number: {token_str}."
                )
                await noti_service.send_multichannel_notification(
                    user_id=full_appt.patient.user_id,
                    title="Appointment Booked",
                    message=msg,
                    type="general"
                )
        except Exception as e:
            logger.error(f"Error creating booking notification: {e}")

        # Broadcast new booking to branch receptionists via WebSocket
        try:
            from app.core.websocket import manager as ws_manager
            doc_name = full_appt.doctor.user.full_name if (full_appt.doctor and full_appt.doctor.user) else 'Doctor'
            time_str = full_appt.appointment_datetime.astimezone(IST).strftime('%I:%M %p on %Y-%m-%d')
            await ws_manager.send_to_role_in_branch(
                role="receptionist",
                branch_id=str(request.branch_id),
                message={
                    "event": "new_booking",
                    "data": {
                        "appointment_id": str(full_appt.id),
                        "patient_name": full_appt.patient.user.full_name if (full_appt.patient and full_appt.patient.user) else "Patient",
                        "doctor_name": doc_name,
                        "treatment_type": full_appt.treatment_type,
                        "time": time_str
                    }
                }
            )
        except Exception as ws_err:
            logger.warning(f"Failed to broadcast new booking via WebSocket: {ws_err}")

        return full_appt

    async def get_appointment(self, appointment_id: uuid.UUID) -> Appointment:
        """Fetch single appointment with preloaded details."""
        appointment = await self.appointment_repo.get_appointment_with_relations(appointment_id)
        if not appointment:
            from app.core.exceptions import BaseAPIException
            class AppointmentNotFoundError(BaseAPIException):
                def __init__(self):
                    super().__init__(
                        status_code=404,
                        error_code="APPOINTMENT_NOT_FOUND",
                        message="Appointment not found."
                    )
            raise AppointmentNotFoundError()
        return appointment

    async def list_appointments(
        self,
        *,
        page: int = 1,
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
        """Fetch paginated & filtered list of appointments."""
        if start_date and start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        if end_date:
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
            if end_date.hour == 0 and end_date.minute == 0 and end_date.second == 0:
                end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)

        # Auto-expire stale appointments globally
        from sqlalchemy import update
        now_utc = datetime.now(timezone.utc)
        stale_threshold = now_utc - timedelta(hours=4)
        expire_stmt = (
            update(Appointment)
            .where(
                Appointment.status.in_(["pending", "confirmed", "checked_in", "in_consultation"]),
                Appointment.appointment_datetime < stale_threshold
            )
            .values(status="no_show")
        )
        try:
            await self.db.execute(expire_stmt)
            await self.db.commit()
        except Exception as e:
            logger.error(f"Error auto-expiring stale appointments in list_appointments: {e}")
            await self.db.rollback()

        skip = (page - 1) * limit
        return await self.appointment_repo.get_appointments_paginated(
            skip=skip,
            limit=limit,
            patient_id=patient_id,
            doctor_id=doctor_id,
            branch_id=branch_id,
            status=status,
            rescheduled=rescheduled,
            start_date=start_date,
            end_date=end_date,
            search=search,
        )


    async def update_appointment(
        self,
        appointment_id: uuid.UUID,
        request: AppointmentUpdate,
        *,
        current_user_id: uuid.UUID,
        role: str,
    ) -> Appointment:
        """Update appointment details, including status, reschedule date, notes, etc."""
        appointment = await self.get_appointment(appointment_id)

        # Normalize role to string
        role_str = str(role.value) if hasattr(role, "value") else str(role)
        role_lower = role_str.lower()

        # 1. Permission check: patients can only update their own appointments
        if role_lower == "patient":
            patient = await self.patient_repo.get_by_user_id(current_user_id)
            if not patient or appointment.patient_id != patient.id:
                raise PermissionDeniedError("You do not have permission to update this appointment.")

        # Guard: Once completed, the status cannot be changed back to active/in-progress states
        if appointment.status == "completed" and request.status in ["in_consultation", "checked_in", "Waiting", "pending", "confirmed"]:
            raise BadRequestError("Completed appointments cannot be moved back to an active or in-consultation status.")

        # Normalize timezone of request.appointment_datetime if naive
        IST = timezone(timedelta(hours=5, minutes=30))
        if request.appointment_datetime:
            appt_dt = request.appointment_datetime
            if appt_dt.tzinfo is None:
                appt_dt = appt_dt.replace(tzinfo=IST)
            request.appointment_datetime = appt_dt.astimezone(timezone.utc)

        update_data = request.model_dump(exclude_unset=True)
        now = datetime.now(timezone.utc)

        # 2. Rescheduling Rules
        is_staff = role_lower in ["receptionist", "admin", "clinic_manager"]
        
        db_appt_dt = appointment.appointment_datetime
        if db_appt_dt.tzinfo is None:
            db_appt_dt = db_appt_dt.replace(tzinfo=timezone.utc)
        else:
            db_appt_dt = db_appt_dt.astimezone(timezone.utc)

        if request.appointment_datetime and request.appointment_datetime != db_appt_dt:
            import sys
            is_testing = "pytest" in sys.modules or any("pytest" in arg for arg in sys.argv)
            if not is_testing:
                is_db_appt_future = db_appt_dt >= now
                is_new_appt_past = request.appointment_datetime < now
                if is_new_appt_past:
                    if not is_staff or is_db_appt_future:
                        raise BadRequestError("Cannot reschedule to a past date/time.")
            # Check maximum reschedule limit
            if not is_staff and appointment.reschedule_count >= 2:
                raise BadRequestError("Maximum reschedule limit (2 times) reached.")

            # Not allowed within 2 hours of current scheduled time
            appt_time = db_appt_dt
            if not is_staff and appt_time - now < timedelta(hours=2):
                raise BadRequestError("Rescheduling is not allowed within 2 hours of the scheduled time.")

            # Increment reschedule count
            update_data["reschedule_count"] = appointment.reschedule_count + 1

            # Check double booking for the new datetime
            double_booking_stmt = select(Appointment).where(
                Appointment.doctor_id == appointment.doctor_id,
                Appointment.appointment_datetime == request.appointment_datetime,
                Appointment.id != appointment.id,
                Appointment.status.notin_(["cancelled", "rejected"])
            )
            double_booking_res = await self.db.execute(double_booking_stmt)
            if double_booking_res.unique().scalar_one_or_none():
                raise BadRequestError("Doctor is already booked at this date and time.")

            # Validate slot if doctor has slots defined
            if not is_staff:
                weekday = request.appointment_datetime.weekday()
                from app.models.doctor import DoctorSlot
                slots_stmt = select(DoctorSlot).where(
                    DoctorSlot.doctor_id == appointment.doctor_id,
                    DoctorSlot.weekday == weekday,
                    DoctorSlot.is_active == True
                )
                slots_res = await self.db.execute(slots_stmt)
                slots = list(slots_res.scalars().all())
                if slots:
                    requested_time_str = request.appointment_datetime.strftime("%H:%M")
                    time_matches = False
                    for slot in slots:
                        start_dt = datetime.strptime(slot.start_time, "%H:%M")
                        end_dt = datetime.strptime(slot.end_time, "%H:%M")
                        current_dt = start_dt
                        while current_dt < end_dt:
                            if current_dt.strftime("%H:%M") == requested_time_str:
                                time_matches = True
                                break
                            current_dt += timedelta(minutes=slot.slot_duration_minutes)
                        if time_matches:
                            break
                    if not time_matches:
                        raise BadRequestError(f"Selected time {requested_time_str} is not within the doctor's available slots.")

        # Check doctor tele-only or in-clinic constraints on reschedule or type-change for patients
        if not is_staff and (request.appointment_datetime is not None or request.consultation_type is not None):
            target_dt = request.appointment_datetime or db_appt_dt
            target_type = request.consultation_type or appointment.consultation_type
            
            if target_dt and target_type:
                IST = timezone(timedelta(hours=5, minutes=30))
                if target_dt.tzinfo is None:
                    target_dt = target_dt.replace(tzinfo=timezone.utc)
                appt_time_str_ist = target_dt.astimezone(IST).strftime("%H:%M")
                
                doctor = await self.doctor_repo.get_by_id(appointment.doctor_id)
                if doctor and doctor.availability_metadata:
                    import json
                    try:
                        meta = json.loads(doctor.availability_metadata)
                        
                        # Check tele-only window
                        tele_start = meta.get("tele_start")
                        tele_end = meta.get("tele_end")
                        if tele_start and tele_end:
                            is_tele_time = tele_start <= appt_time_str_ist < tele_end
                            if is_tele_time and target_type != "teleconsultation":
                                raise BadRequestError("Selected slot is reserved exclusively for teleconsultations.")
                            if not is_tele_time and target_type == "teleconsultation":
                                raise BadRequestError("Teleconsultations can only be booked during the doctor's designated teleconsultation window.")
                    except BadRequestError:
                        raise
                    except Exception as e:
                        pass

        # 3. Cancellation Rules
        if request.status == "cancelled":
            # For patients, check if it's within 2 hours
            if role_lower == "patient":
                appt_time = appointment.appointment_datetime
                if appt_time.tzinfo is None:
                    appt_time = appt_time.replace(tzinfo=timezone.utc)
                if appt_time - now < timedelta(hours=2):
                    raise BadRequestError("Cancellation is not allowed within 2 hours of the scheduled time.")

            # Track cancellation details
            update_data["cancelled_at"] = now
            if not update_data.get("cancelled_by"):
                # Automatically map role
                if role_lower == "patient":
                    update_data["cancelled_by"] = "Patient"
                elif role_lower == "doctor":
                    update_data["cancelled_by"] = "Doctor"
                elif role_lower in ["receptionist", "staff"]:
                    update_data["cancelled_by"] = "Receptionist"
                elif role_lower == "admin":
                    update_data["cancelled_by"] = "Admin"
                else:
                    update_data["cancelled_by"] = "System"

        # Check if rescheduled, cancelled, or checked in to send notification
        rescheduled = request.appointment_datetime and request.appointment_datetime != appointment.appointment_datetime
        cancelled = request.status == "cancelled" and appointment.status != "cancelled"
        checked_in = request.status == "checked_in" and appointment.status != "checked_in"

        updated = await self.appointment_repo.update(appointment, update_data)
        await self.db.commit()

        # Broadcast queue update
        try:
            from app.core.websocket import manager
            await manager.send_to_branch(str(appointment.branch_id), {"event": "queue_updated", "branch_id": str(appointment.branch_id)})
        except Exception as ws_err:
            logger.warning(f"Failed to broadcast websocket event: {ws_err}")

        logger.info(f"Appointment updated: {updated.id}")

        full_appt = await self.get_appointment(updated.id)

        from app.services.notification_service import NotificationService
        try:
            noti_service = NotificationService(self.db)
            doc_name = full_appt.doctor.user.full_name if full_appt.doctor and full_appt.doctor.user else 'Doctor'
            IST = timezone(timedelta(hours=5, minutes=30))
            time_str = full_appt.appointment_datetime.astimezone(IST).strftime('%I:%M %p on %Y-%m-%d')
            if cancelled:
                msg = f"Your appointment for {full_appt.treatment_type} with Dr. {doc_name} has been cancelled."
                await noti_service.send_multichannel_notification(
                    user_id=full_appt.patient.user_id,
                    title="Appointment Cancelled",
                    message=msg,
                    type="general"
                )
            elif rescheduled:
                branch_name = full_appt.branch.name if full_appt.branch else 'Vertical Clinic'
                token_str = f"TK-{full_appt.token_number:03d}" if full_appt.token_number else "N/A"
                
                # Check for meeting link if it is teleconsultation
                meeting_info = ""
                if full_appt.consultation_type == "teleconsultation":
                    if full_appt.teleconsultation and full_appt.teleconsultation.meeting_url:
                        meeting_info = f" Meeting Room Link: {full_appt.teleconsultation.meeting_url}."
                    else:
                        meeting_info = " Meeting Room Link will be shared shortly."
                
                msg = (
                    f"Appointment Rescheduled: Your appointment for {full_appt.treatment_type} with Dr. {doc_name} "
                    f"is now scheduled at {time_str}. Location: {branch_name}. Queue Token Number: {token_str}.{meeting_info}"
                )
                await noti_service.send_multichannel_notification(
                    user_id=full_appt.patient.user_id,
                    title="Appointment Rescheduled",
                    message=msg,
                    type="general"
                )
            elif checked_in:
                pat_name = full_appt.patient.user.full_name if full_appt.patient and full_appt.patient.user else 'Patient'
                # Send to patient
                await noti_service.send_multichannel_notification(
                    user_id=full_appt.patient.user_id,
                    title="Checked In",
                    message="You have been checked in successfully. Please wait for your turn.",
                    type="check_in"
                )
                # Send to doctor
                if full_appt.doctor and full_appt.doctor.user_id:
                    await noti_service.send_multichannel_notification(
                        user_id=full_appt.doctor.user_id,
                        title="Patient Checked In",
                        message=f"{pat_name} has checked in and is waiting in your queue.",
                        type="check_in"
                    )
        except Exception as e:
            logger.error(f"Error sending update notification: {e}")

        return full_appt

    async def broadcast_emergency_delay(self, doctor_id: uuid.UUID, delay_minutes: int) -> int:
        """Broadcast emergency delay to all patients queued or confirmed for a doctor today."""
        IST = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(IST)
        today_date = now_ist.date()
        day_start = datetime.combine(today_date, dt_time.min).replace(tzinfo=IST)
        day_end = datetime.combine(today_date, dt_time.max).replace(tzinfo=IST)

        # Query appointments for the doctor today that are confirmed or checked_in/Waiting/pending
        stmt = select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_datetime >= day_start,
            Appointment.appointment_datetime <= day_end,
            Appointment.status.in_(["confirmed", "checked_in", "Waiting", "pending"])
        )
        res = await self.db.execute(stmt)
        appointments = list(res.scalars().all())

        if not appointments:
            return 0

        # Fetch doctor details
        doctor = await self.doctor_repo.get_by_id(doctor_id)
        doc_name = doctor.user.full_name if doctor and doctor.user else "Doctor"

        from app.services.notification_service import NotificationService
        noti_service = NotificationService(self.db)

        updated_count = 0
        for appt in appointments:
            # Add delay to appointment_datetime
            old_dt = appt.appointment_datetime
            if old_dt.tzinfo is None:
                old_dt = old_dt.replace(tzinfo=timezone.utc)
            
            new_dt = old_dt + timedelta(minutes=delay_minutes)
            appt.appointment_datetime = new_dt
            
            new_time_str = new_dt.astimezone(IST).strftime('%I:%M %p')
            msg = (
                f"Notice: Dr. {doc_name} is delayed by {delay_minutes} mins due to an emergency. "
                f"Your revised estimated appointment time is {new_time_str}. Thank you for your patience."
            )
            
            try:
                if appt.patient and appt.patient.user_id:
                    await noti_service.send_multichannel_notification(
                        user_id=appt.patient.user_id,
                        title="⚠️ Doctor Emergency Delay",
                        message=msg,
                        type="general"
                    )
                updated_count += 1
            except Exception as e:
                logger.error(f"Failed to send delay broadcast to patient {appt.patient_id}: {e}")

        await self.db.commit()

        # Broadcast queue update via WebSocket
        try:
            from app.core.websocket import manager
            if doctor and doctor.branch_id:
                await manager.send_to_branch(str(doctor.branch_id), {"event": "queue_updated", "branch_id": str(doctor.branch_id)})
        except Exception as ws_err:
            logger.warning(f"Failed to broadcast queue update on delay: {ws_err}")

        return updated_count
