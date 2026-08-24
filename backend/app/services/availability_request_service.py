"""
AvailabilityRequestService — business logic for managing doctor schedule change requests.
"""
from __future__ import annotations

import uuid
import json
import logging
from datetime import datetime, timezone, timedelta, time as dt_time
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.core.exceptions import BadRequestError, PermissionDeniedError
from app.models.availability_request import AvailabilityChangeRequest
from app.models.doctor import Doctor, DoctorSlot
from app.models.appointment import Appointment
from app.models.user import User
from app.schemas.availability_request import AvailabilityChangeRequestCreate, AvailabilityChangeRequestUpdate
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))  # UTC+5:30


class AvailabilityRequestService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.noti_service = NotificationService(db)

    async def create_request(
        self, user_id: uuid.UUID, request_data: AvailabilityChangeRequestCreate
    ) -> AvailabilityChangeRequest:
        """Create a schedule change request for a doctor or other staff."""
        res_user = await self.db.execute(select(User).where(User.id == user_id))
        user = res_user.scalar_one_or_none()
        if not user:
            raise BadRequestError("User not found.")

        doctor_id = None
        if user.role == "doctor":
            res_doc = await self.db.execute(select(Doctor).where(Doctor.user_id == user_id))
            doctor = res_doc.scalar_one_or_none()
            if not doctor:
                raise BadRequestError("Doctor profile not found for this user account.")
            doctor_id = doctor.id

        req = AvailabilityChangeRequest(
            doctor_id=doctor_id,
            user_id=user_id,
            request_type=request_data.request_type,
            proposed_start_time=request_data.proposed_start_time,
            proposed_end_time=request_data.proposed_end_time,
            proposed_start_date=request_data.proposed_start_date,
            proposed_end_date=request_data.proposed_end_date,
            reason=request_data.reason,
            status="pending",
        )
        self.db.add(req)
        await self.db.flush()
        await self.db.commit()
        logger.info(f"User {user_id} created schedule change request {req.id}")
        return req

    async def get_requests(self, user_id: uuid.UUID, role: str) -> list[AvailabilityChangeRequest]:
        """Fetch all requests, filtering by doctor/user if not admin."""
        if role == "admin":
            stmt = select(AvailabilityChangeRequest).order_by(AvailabilityChangeRequest.created_at.desc())
        elif role == "doctor":
            res = await self.db.execute(select(Doctor).where(Doctor.user_id == user_id))
            doctor = res.scalar_one_or_none()
            if not doctor:
                return []
            stmt = select(AvailabilityChangeRequest).where(
                AvailabilityChangeRequest.doctor_id == doctor.id
            ).order_by(AvailabilityChangeRequest.created_at.desc())
        else:
            # Receptionist or Pharmacist
            stmt = select(AvailabilityChangeRequest).where(
                AvailabilityChangeRequest.user_id == user_id
            ).order_by(AvailabilityChangeRequest.created_at.desc())

        res_reqs = await self.db.execute(stmt)
        reqs = list(res_reqs.scalars().all())

        # Hydrate requester names
        for r in reqs:
            if r.doctor_id:
                stmt_doc = select(User).join(Doctor, Doctor.user_id == User.id).where(Doctor.id == r.doctor_id)
                res_user = await self.db.execute(stmt_doc)
                user = res_user.scalar_one_or_none()
                r.doctor_name = user.full_name if user else "Doctor"
            elif r.user_id:
                stmt_user = select(User).where(User.id == r.user_id)
                res_user = await self.db.execute(stmt_user)
                user = res_user.scalar_one_or_none()
                r.doctor_name = user.full_name if user else "Staff"
            else:
                r.doctor_name = "Staff"

        return reqs

    async def update_request_status(
        self, request_id: uuid.UUID, request_data: AvailabilityChangeRequestUpdate
    ) -> dict:
        """Update availability request status (Approve or Reject). If approved, update doctor availability metadata."""
        stmt = select(AvailabilityChangeRequest).where(AvailabilityChangeRequest.id == request_id)
        res = await self.db.execute(stmt)
        req = res.scalar_one_or_none()
        if not req:
            raise BadRequestError("Availability request not found.")

        if req.status != "pending":
            raise BadRequestError(f"Request is already resolved as {req.status}.")

        req.status = request_data.status
        req.updated_at = datetime.now(timezone.utc)

        # Load doctor and user if doctor_id is present
        doctor = None
        if req.doctor_id:
            stmt_doc = select(Doctor).options(selectinload(Doctor.user)).where(Doctor.id == req.doctor_id)
            res_doc = await self.db.execute(stmt_doc)
            doctor = res_doc.scalar_one_or_none()
 
        conflicts = []
 
        if request_data.status == "approved":
            if doctor:
                # Parse existing metadata
                meta = {}
                if doctor.availability_metadata:
                    try:
                        meta = json.loads(doctor.availability_metadata)
                    except Exception:
                        pass
 
                # Apply change based on request type
                if req.request_type == "lunch_break":
                    meta["lunch_start"] = req.proposed_start_time
                    meta["lunch_end"] = req.proposed_end_time
                elif req.request_type == "teleconsultation":
                    meta["tele_start"] = req.proposed_start_time
                    meta["tele_end"] = req.proposed_end_time
                elif req.request_type == "leave":
                    leaves = meta.get("leaves", [])
                    leaves.append({
                        "start_date": req.proposed_start_date.isoformat() if req.proposed_start_date else None,
                        "end_date": req.proposed_end_date.isoformat() if req.proposed_end_date else None,
                        "reason": req.reason
                    })
                    meta["leaves"] = leaves
                elif req.request_type == "shift_timing":
                    # Shift timings change
                    # We can update the metadata and doctor slots
                    meta["shift_start"] = req.proposed_start_time
                    meta["shift_end"] = req.proposed_end_time
                    
                    # Update existing weekly slots to fit the new timings
                    stmt_slots = select(DoctorSlot).where(DoctorSlot.doctor_id == doctor.id)
                    res_slots = await self.db.execute(stmt_slots)
                    slots = list(res_slots.scalars().all())
                    for slot in slots:
                        slot.start_time = req.proposed_start_time
                        slot.end_time = req.proposed_end_time
 
                doctor.availability_metadata = json.dumps(meta)
                self.db.add(doctor)
 
                # Check for conflicting appointments
                stmt_appt = select(Appointment).options(joinedload(Appointment.patient)).where(
                    Appointment.doctor_id == doctor.id,
                    Appointment.status.notin_(["cancelled", "rejected", "completed"])
                )
                res_appts = await self.db.execute(stmt_appt)
                appts = list(res_appts.scalars().all())
 
                for appt in appts:
                    appt_dt = appt.appointment_datetime.astimezone(IST)
                    appt_date = appt_dt.date()
                    appt_time_str = appt_dt.strftime("%H:%M")
 
                    is_conflict = False
 
                    if req.request_type == "leave" and req.proposed_start_date and req.proposed_end_date:
                        if req.proposed_start_date <= appt_date <= req.proposed_end_date:
                            is_conflict = True
 
                    elif req.request_type == "lunch_break" and req.proposed_start_time and req.proposed_end_time:
                        if req.proposed_start_time <= appt_time_str < req.proposed_end_time:
                            is_conflict = True
 
                    elif req.request_type == "shift_timing" and req.proposed_start_time and req.proposed_end_time:
                        if not (req.proposed_start_time <= appt_time_str < req.proposed_end_time):
                            is_conflict = True
 
                    if is_conflict:
                        # Flag this appointment as pending/rescheduling needed
                        appt.status = "pending"
                        self.db.add(appt)
                        
                        # Fetch patient name
                        p_name = "Patient"
                        if appt.patient:
                            # Need to load user name
                            stmt_user = select(User).where(User.id == appt.patient.user_id)
                            res_user = await self.db.execute(stmt_user)
                            p_user = res_user.scalar_one_or_none()
                            if p_user:
                                p_name = p_user.full_name
 
                        conflicts.append({
                            "id": str(appt.id),
                            "appointment_datetime": appt_dt.isoformat(),
                            "patient_name": p_name,
                        })
                        
                        # Notify Patient
                        title = "Appointment Schedule Update"
                        msg = (
                            f"Dear patient, due to a doctor schedule change, your appointment with Dr. {doctor.user.full_name} "
                            f"on {appt_date.strftime('%Y-%m-%d')} at {appt_dt.strftime('%I:%M %p')} needs to be rescheduled. "
                            f"Please log in and select a new available slot."
                        )
                        await self.noti_service.send_multichannel_notification(
                            user_id=appt.patient.user_id if appt.patient else doctor.user_id,
                            title=title,
                            message=msg,
                            type="alert"
                        )
 
                # Notify Doctor about approval
                title = "Availability Change Request Approved"
                msg = f"Your request to change {req.request_type.replace('_', ' ')} has been approved by the Admin."
                await self.noti_service.send_multichannel_notification(
                    user_id=doctor.user_id, title=title, message=msg, type="general"
                )
            elif req.user_id:
                # Notify Staff about approval
                title = "Leave Request Approved"
                msg = f"Your leave request from {req.proposed_start_date} to {req.proposed_end_date} has been approved by the Admin."
                await self.noti_service.send_multichannel_notification(
                    user_id=req.user_id, title=title, message=msg, type="general"
                )
 
        elif request_data.status == "rejected":
            if doctor:
                # Notify Doctor about rejection
                title = "Availability Change Request Rejected"
                reason_str = f" Reason: {request_data.rejection_reason}" if request_data.rejection_reason else ""
                msg = f"Your request to change {req.request_type.replace('_', ' ')} was rejected by the Admin.{reason_str}"
                await self.noti_service.send_multichannel_notification(
                    user_id=doctor.user_id, title=title, message=msg, type="general"
                )
            elif req.user_id:
                # Notify Staff about rejection
                title = "Leave Request Rejected"
                reason_str = f" Reason: {request_data.rejection_reason}" if request_data.rejection_reason else ""
                msg = f"Your leave request was rejected by the Admin.{reason_str}"
                await self.noti_service.send_multichannel_notification(
                    user_id=req.user_id, title=title, message=msg, type="general"
                )
 
        await self.db.commit()
        return {
            "success": True,
            "status": req.status,
            "conflicts": conflicts
        }
