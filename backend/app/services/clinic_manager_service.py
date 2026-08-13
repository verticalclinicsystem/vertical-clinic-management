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
from app.models.notification import Notification
from app.models.invoice import Invoice
from app.models.patient import Patient

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
        cleaned_name = full_name
        if cleaned_name.lower().startswith("dr. "):
            cleaned_name = cleaned_name[4:].strip()
        elif cleaned_name.lower().startswith("dr.  "):
            cleaned_name = cleaned_name[5:].strip()

        hashed_pwd = hash_password(password)
        user = User(
            id=uuid.uuid4(),
            email=email,
            phone=phone,
            hashed_password=hashed_pwd,
            full_name=cleaned_name,
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
            name=user.full_name,
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

        code = employee_code or f"RC-{uuid.uuid4().hex[:6].upper()}"
        receptionist = Receptionist(
            id=uuid.uuid4(),
            user_id=user.id,
            name=user.full_name,
            branch_id=branch_id,
            employee_id=code,
            shift_start="09:00",
            shift_end="17:00",
            is_active=True,
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
                    "full_name": d.user.full_name if d.user else (d.name or "N/A"),
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
                    "full_name": r.user.full_name if r.user else (r.name or "N/A"),
                    "email": r.user.email if r.user else "N/A",
                    "phone": r.user.phone if r.user else "N/A",
                    "employee_code": r.employee_id,
                    "shift_timing": f"{r.shift_start} - {r.shift_end}",
                    "is_on_duty": r.is_active,
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
                "doctor_id": str(req.doctor_id) if req.doctor_id else None,
                "doctor_name": doc_name,
                "request_type": req.request_type,
                "status": req.status,
                "reason": req.reason,
                "proposed_start_date": req.proposed_start_date.isoformat() if req.proposed_start_date else None,
                "proposed_end_date": req.proposed_end_date.isoformat() if req.proposed_end_date else None,
                "proposed_start_time": req.proposed_start_time,
                "proposed_end_time": req.proposed_end_time,
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
            await self.db.commit()
            return {"id": str(req.id), "status": "rejected", "message": "Request rejected successfully."}

        # Approve logic
        req.status = "approved"

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

    async def onboard_pharmacist(
        self,
        *,
        email: str,
        password: str,
        full_name: str,
        phone: str | None = None,
        branch_id: uuid.UUID | None = None,
        employee_code: str | None = None,
    ) -> dict[str, Any]:
        """Onboard a new Pharmacist user."""
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
            role=UserRole.PHARMACIST,
            branch_id=branch_id,
            is_active=True,
            is_verified=True,
        )
        self.db.add(user)
        await self.db.commit()

        return {
            "user_id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "role": "pharmacist",
            "branch_id": str(branch_id) if branch_id else None,
            "message": f"Pharmacist {user.full_name} onboarded successfully.",
        }

    async def edit_staff_member(
        self,
        user_id: uuid.UUID,
        *,
        full_name: str | None = None,
        phone: str | None = None,
        is_active: bool | None = None,
        consultation_fee: float | None = None,
        specialization: str | None = None,
        shift_timing: str | None = None,
    ) -> dict[str, Any]:
        """Edit staff user and associated role profile."""
        stmt = select(User).where(User.id == user_id)
        res = await self.db.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            raise NotFoundError("Staff user not found.")

        if full_name is not None:
            user.full_name = full_name
        if phone is not None:
            user.phone = phone
        if is_active is not None:
            user.is_active = is_active

        # Profile updates
        if user.role == UserRole.DOCTOR:
            doc_stmt = select(Doctor).where(Doctor.user_id == user.id)
            doc_res = await self.db.execute(doc_stmt)
            doc = doc_res.scalar_one_or_none()
            if doc:
                if full_name is not None:
                    doc.name = full_name
                if consultation_fee is not None:
                    doc.consultation_fee = consultation_fee
                if specialization is not None:
                    doc.specialization = specialization
                if is_active is not None:
                    doc.is_available = is_active

        elif user.role == UserRole.RECEPTIONIST:
            rec_stmt = select(Receptionist).where(Receptionist.user_id == user.id)
            rec_res = await self.db.execute(rec_stmt)
            rec = rec_res.scalar_one_or_none()
            if rec:
                if full_name is not None:
                    rec.name = full_name
                if shift_timing is not None:
                    rec.shift_timing = shift_timing

        await self.db.commit()
        return {"user_id": str(user.id), "full_name": user.full_name, "message": "Staff details updated successfully."}

    async def emergency_doctor_block(
        self,
        doctor_id: uuid.UUID,
        leave_date_str: str,
        target_reschedule_date_str: str | None = None,
    ) -> dict[str, Any]:
        """
        Emergency Freeze Doctor Schedule & Bulk Reschedule Engine:
        1. Query all active appointments for doctor_id on leave_date_str.
        2. Generate unbooked time slots on target_reschedule_date_str (or next day).
        3. Provisionally reschedule each appointment to an open slot with status 'rescheduled_pending'.
        4. Send automated notification to each patient.
        """
        # Parse leave date
        try:
            l_date = datetime.strptime(leave_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise BadRequestError("Invalid leave date format. Use YYYY-MM-DD.")

        if target_reschedule_date_str:
            try:
                t_date = datetime.strptime(target_reschedule_date_str, "%Y-%m-%d").date()
            except ValueError:
                t_date = l_date + timedelta(days=1)
        else:
            t_date = l_date + timedelta(days=1)

        # Get Doctor
        doc_stmt = select(Doctor).options(joinedload(Doctor.user)).where(Doctor.id == doctor_id)
        doc_res = await self.db.execute(doc_stmt)
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            raise NotFoundError("Doctor profile not found.")

        # Mark doctor leave in metadata
        meta: dict[str, Any] = {}
        if doctor.availability_metadata and isinstance(doctor.availability_metadata, str):
            try:
                meta = json.loads(doctor.availability_metadata)
            except Exception:
                meta = {}
        leaves = meta.get("leaves", [])
        leaves.append({"start_date": leave_date_str, "end_date": leave_date_str, "reason": "Emergency Absence"})
        meta["leaves"] = leaves
        doctor.availability_metadata = json.dumps(meta)

        # Query impacted appointments on leave_date_str
        IST = timedelta(hours=5, minutes=30)
        start_dt = datetime.combine(l_date, datetime.min.time()) - IST
        end_dt = datetime.combine(l_date, datetime.max.time()) - IST

        appts_stmt = select(Appointment).options(joinedload(Appointment.patient)).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_datetime >= start_dt,
            Appointment.appointment_datetime <= end_dt,
            Appointment.status.in_(["scheduled", "confirmed", "checked_in", "ready", "in_queue"]),
        )
        appts_res = await self.db.execute(appts_stmt)
        impacted_appts = list(appts_res.scalars().all())

        if not impacted_appts:
            await self.db.commit()
            return {
                "doctor_name": doctor.user.full_name if doctor.user else doctor.name,
                "leave_date": leave_date_str,
                "impacted_count": 0,
                "message": f"Doctor schedule frozen for {leave_date_str}. No active appointments were impacted.",
            }

        # Query existing appointments on target_date to avoid slot collisions
        t_start_dt = datetime.combine(t_date, datetime.min.time()) - IST
        t_end_dt = datetime.combine(t_date, datetime.max.time()) - IST

        existing_t_stmt = select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_datetime >= t_start_dt,
            Appointment.appointment_datetime <= t_end_dt,
            Appointment.status.notin_(["cancelled", "rejected"]),
        )
        existing_t_res = await self.db.execute(existing_t_stmt)
        existing_times = {a.appointment_datetime.astimezone().strftime("%H:%M") for a in existing_t_res.scalars().all()}

        # Generate candidate slots starting at 09:00 AM
        slot_hours = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]
        available_slots = [s for s in slot_hours if s not in existing_times]

        rescheduled_details = []
        for idx, appt in enumerate(impacted_appts):
            chosen_time_str = available_slots[idx] if idx < len(available_slots) else f"{9 + (idx // 2):02d}:{(idx % 2)*30:02d}"
            h, m = map(int, chosen_time_str.split(":"))
            new_local_dt = datetime(t_date.year, t_date.month, t_date.day, h, m)
            new_utc_dt = new_local_dt - IST

            appt.appointment_datetime = new_utc_dt
            appt.status = "rescheduled_pending"

            # Create notification for patient
            if appt.patient and appt.patient.user_id:
                notif = Notification(
                    user_id=appt.patient.user_id,
                    title="⚠️ Appointment Rescheduled (Emergency)",
                    message=f"Dr. {doctor.name} is on emergency leave today ({leave_date_str}). Your appointment has been provisionally moved to {t_date.strftime('%d-%b-%Y')} at {chosen_time_str}. Please confirm or select a new slot.",
                    type="general",
                )
                self.db.add(notif)

            rescheduled_details.append({
                "appointment_id": str(appt.id),
                "patient_name": appt.patient.name or (appt.patient.user.full_name if appt.patient and appt.patient.user else "Patient") if appt.patient else "Patient",
                "new_date": t_date.strftime("%Y-%m-%d"),
                "new_time": chosen_time_str,
                "status": "rescheduled_pending",
            })

        await self.db.commit()

        return {
            "doctor_name": doctor.name,
            "leave_date": leave_date_str,
            "target_date": t_date.strftime("%Y-%m-%d"),
            "impacted_count": len(impacted_appts),
            "rescheduled_appointments": rescheduled_details,
            "message": f"Successfully frozen schedule and bulk-rescheduled {len(impacted_appts)} patients to {t_date.strftime('%d-%b-%Y')} with automated confirmation alerts.",
        }

    async def get_billing_requests(self, branch_id: uuid.UUID | None = None) -> list[dict[str, Any]]:
        """Fetch invoices with discounts or pending manager approval."""
        stmt = select(Invoice).options(joinedload(Invoice.patient).joinedload(Patient.user)).order_by(Invoice.created_at.desc())
        res = await self.db.execute(stmt)
        invoices = list(res.scalars().all())

        out = []
        for inv in invoices:
            p_name = "N/A"
            if inv.patient:
                p_name = inv.patient.name or (inv.patient.user.full_name if inv.patient.user else "Patient")
            if float(inv.discount_amount or 0) > 0 or inv.status in ["unpaid", "partially_paid"]:
                out.append({
                    "id": str(inv.id),
                    "invoice_number": inv.invoice_number,
                    "patient_name": p_name,
                    "total_amount": float(inv.total_amount or 0),
                    "discount_amount": float(inv.discount_amount or 0),
                    "grand_total": float(inv.grand_total or 0),
                    "balance_due": float(inv.balance_due or 0),
                    "status": inv.status,
                    "created_at": inv.created_at.strftime("%Y-%m-%d %I:%M %p") if inv.created_at else "N/A",
                })
        return out

    async def review_billing_request(
        self,
        invoice_id: uuid.UUID,
        *,
        action: str,  # "approve" or "reject"
        reason_notes: str | None = None,
    ) -> dict[str, Any]:
        """Approve or reject a discount/refund billing override."""
        stmt = select(Invoice).where(Invoice.id == invoice_id)
        res = await self.db.execute(stmt)
        inv = res.scalar_one_or_none()
        if not inv:
            raise NotFoundError("Invoice not found.")

        if action == "reject":
            # Revert discount
            inv.grand_total = float(inv.total_amount or 0)
            inv.discount_amount = 0.0
            inv.balance_due = max(0.0, inv.grand_total - float(inv.amount_paid or 0))
            await self.db.commit()
            return {"id": str(inv.id), "status": "rejected", "message": "Discount override rejected & reverted by Manager."}

        await self.db.commit()
        return {"id": str(inv.id), "status": "approved", "message": "Discount / Refund override approved by Manager."}

    async def create_announcement(
        self,
        *,
        title: str,
        message: str,
        target_role: str = "all",  # "all" | "doctor" | "receptionist" | "pharmacist"
        branch_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Broadcast an internal notice to clinic staff members."""
        roles = ["doctor", "receptionist", "pharmacist"] if target_role == "all" else [target_role]
        user_stmt = select(User).where(User.role.in_(roles))
        if branch_id:
            user_stmt = user_stmt.where(User.branch_id == branch_id)
        res = await self.db.execute(user_stmt)
        target_users = list(res.scalars().all())

        count = 0
        for u in target_users:
            notif = Notification(
                user_id=u.id,
                title=f"📢 Notice: {title}",
                message=message,
                type="general",
            )
            self.db.add(notif)
            count += 1

        await self.db.commit()
        return {
            "title": title,
            "message": message,
            "target_role": target_role,
            "recipient_count": count,
            "message_text": f"Announcement broadcasted to {count} clinic staff members.",
        }

