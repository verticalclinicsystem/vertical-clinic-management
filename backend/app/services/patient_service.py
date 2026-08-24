"""
Patient service — coordinates business logic for patient profiles and search.
"""
from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.exceptions import (
    PatientNotFoundError, BranchNotFoundError, EmailAlreadyExistsError, ConflictError
)
from app.core.security import hash_password
from app.models.patient import Patient
from app.repositories.appointment_repo import AppointmentRepository
from app.repositories.branch_repo import BranchRepository
from app.repositories.consultation_repo import ConsultationRepository
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.patient_repo import PatientRepository
from app.repositories.prescription_repo import PrescriptionRepository
from app.repositories.user_repo import UserRepository
from app.schemas.patient import PatientUpdate, PatientCreate

logger = logging.getLogger(__name__)


class PatientService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.patient_repo = PatientRepository(db)
        self.branch_repo = BranchRepository(db)

    async def create_walkin_patient(self, request: PatientCreate) -> Patient:
        """Create a new pre-verified patient (receptionist/admin flow)."""
        user_repo = UserRepository(self.db)
        if await user_repo.email_exists(request.email):
            raise EmailAlreadyExistsError()
        if request.phone and await user_repo.phone_exists(request.phone):
            raise ConflictError("A user with this phone number already exists.")

        # Generate a random password since receptionist is onboarding them
        temp_password = secrets.token_urlsafe(12)
        hashed_password = hash_password(temp_password)

        user = await user_repo.create({
            "full_name": request.full_name.strip(),
            "email": request.email.lower().strip(),
            "phone": request.phone,
            "hashed_password": hashed_password,
            "role": "patient",
            "is_active": True,
            "is_verified": True, # Pre-verified walk-in!
        })

        patient_code = await self.patient_repo.generate_patient_code()
        
        patient_data = {
            "user_id": user.id,
            "patient_code": patient_code,
            "date_of_birth": request.date_of_birth,
            "gender": request.gender,
            "blood_group": request.blood_group,
            "allergies": request.allergies,
            "chronic_conditions": request.chronic_conditions,
            "address": request.address,
            "emergency_contact_name": request.emergency_contact_name,
            "emergency_contact_relation": request.emergency_contact_relation,
            "emergency_contact_phone": request.emergency_contact_phone,
            "insurance_provider": request.insurance_provider,
            "insurance_policy_no": request.insurance_policy_no,
            "preferred_payment_method": request.preferred_payment_method,
            "preferred_branch_id": request.preferred_branch_id,
        }
        
        patient = await self.patient_repo.create(patient_data)
        await self.db.commit()
        logger.info(f"Walk-in patient created by staff: {patient.patient_code}")
        return await self.get_patient(patient.id)

    async def get_patient(self, patient_id: uuid.UUID) -> Patient:
        """Retrieve a patient profile by ID (with User loaded)."""
        patient = await self.patient_repo.get_patient_with_user(patient_id)
        if not patient:
            raise PatientNotFoundError()
        return patient

    async def get_patient_by_user_id(self, user_id: uuid.UUID) -> Patient:
        """Retrieve a patient profile by linked User ID."""
        patient = await self.patient_repo.get_patient_by_user_id_with_user(user_id)
        if not patient:
            raise PatientNotFoundError()
        return patient

    async def get_patient_by_code(self, code: str) -> Patient:
        """Retrieve a patient profile by unique patient code."""
        patient = await self.patient_repo.get_patient_by_code_with_user(code)
        if not patient:
            raise PatientNotFoundError()
        return patient

    async def get_all_patients(
        self,
        *,
        page: int = 1,
        limit: int = 20,
        search: str | None = None,
    ) -> tuple[list[Patient], int]:
        """Get paginated and searched list of patients."""
        skip = (page - 1) * limit
        if search:
            query = search.strip()
            items = await self.patient_repo.list_patients_with_user(skip=skip, limit=limit, search=query)
            total = await self.patient_repo.count_search(query)
        else:
            items = await self.patient_repo.list_patients_with_user(skip=skip, limit=limit)
            total = await self.patient_repo.count()
            
        return items, total

    async def update_patient_profile(self, patient_id: uuid.UUID, request: PatientUpdate) -> Patient:
        """Update clinical demographics and preferred branch of a patient profile."""
        patient = await self.get_patient(patient_id)
        update_data = request.model_dump(exclude_unset=True)

        # Handle full_name update on the User model
        if "full_name" in update_data:
            full_name = update_data.pop("full_name")
            if full_name and patient.user:
                patient.user.full_name = full_name

        # Handle phone update on the User model
        if "phone" in update_data:
            phone = update_data.pop("phone")
            if patient.user:
                patient.user.phone = phone

        if "preferred_branch_id" in update_data and update_data["preferred_branch_id"] is not None:
            branch = await self.branch_repo.get_by_id(update_data["preferred_branch_id"])
            if not branch:
                raise BranchNotFoundError()

        updated_patient = await self.patient_repo.update(patient, update_data)
        await self.db.commit()
        logger.info(f"Patient profile updated: {updated_patient.patient_code}")
        # Re-fetch with user relation loaded
        return await self.get_patient(updated_patient.id)


    async def deactivate_patient(self, patient_id: uuid.UUID) -> Patient:
        """Soft-deactivate a patient profile (deactivates is_active status)."""
        patient = await self.get_patient(patient_id)
        updated_patient = await self.patient_repo.update(patient, {"is_active": False})
        await self.db.commit()
        logger.info(f"Patient profile deactivated: {updated_patient.patient_code}")
        return await self.get_patient(updated_patient.id)

    async def activate_patient(self, patient_id: uuid.UUID) -> Patient:
        """Re-activate a deactivated patient profile."""
        patient = await self.get_patient(patient_id)
        updated_patient = await self.patient_repo.update(patient, {"is_active": True})
        await self.db.commit()
        logger.info(f"Patient profile activated: {updated_patient.patient_code}")
        return await self.get_patient(updated_patient.id)

    async def get_patient_dashboard(self, user_id: uuid.UUID) -> dict:
        """Fetch dashboard statistics, upcoming appointments, and prescriptions for a patient."""
        patient = await self.get_patient_by_user_id(user_id)
        
        # Branch name
        branch_name = None
        if patient.preferred_branch_id:
            branch = await self.branch_repo.get_by_id(patient.preferred_branch_id)
            if branch:
                branch_name = branch.name

        # Query live upcoming appointments via Repository
        now = datetime.now(timezone.utc)
        appt_repo = AppointmentRepository(self.db)
        appointments_list = await appt_repo.get_upcoming_patient_appointments(patient.id, now)

        upcoming_appointments = []
        for appt in appointments_list:
            upcoming_appointments.append({
                "id": str(appt.id),
                "appointment_datetime": appt.appointment_datetime.isoformat(),
                "treatment_type": appt.treatment_type,
                "consultation_type": appt.consultation_type,
                "status": appt.status,
                "doctor_name": appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Doctor",
                "branch_name": appt.branch.name if appt.branch else None,
            })

        # Query real prescriptions via Repository
        presc_repo = PrescriptionRepository(self.db)
        prescriptions_list = await presc_repo.get_recent_patient_prescriptions(patient.id, limit=5)
        
        recent_prescriptions = []
        for presc in prescriptions_list:
            recent_prescriptions.append({
                "id": str(presc.id),
                "created_at": presc.created_at.isoformat(),
                "doctor_name": presc.doctor.user.full_name if presc.doctor and presc.doctor.user else "Doctor",
                "medicines_count": len(presc.items),
                "items": [
                    {
                        "medicine_name": item.medicine_name,
                        "dosage": item.dosage,
                        "duration": item.duration,
                        "instructions": item.instructions
                    } for item in presc.items
                ]
            })

        # Query real visits count for this calendar year via Repository
        current_year = datetime.now(timezone.utc).year
        start_of_year = datetime(current_year, 1, 1, tzinfo=timezone.utc)
        
        consult_repo = ConsultationRepository(self.db)
        visits_this_year = await consult_repo.get_visits_count(patient.id, start_of_year)
        
        # Query real balance due via Repository
        invoice_repo = InvoiceRepository(self.db)
        total_balance_due = await invoice_repo.get_total_balance_due(patient.id)

        return {
            "patient_code": patient.patient_code,
            "full_name": patient.user.full_name if patient.user else None,
            "preferred_branch": branch_name,
            "upcoming_appointments_count": len(upcoming_appointments),
            "active_prescriptions_count": len(recent_prescriptions),
            "balance_due": total_balance_due,
            "visits_this_year": visits_this_year,
            "upcoming_appointments": upcoming_appointments,
            "recent_prescriptions": recent_prescriptions,
        }
