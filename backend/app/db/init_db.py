"""
Database initialization and seeder.
Seeds real clinic data: branches, staff, doctors, patients, appointments, and clinical records.
No dummy/static data — everything goes into PostgreSQL.
"""
from __future__ import annotations

import contextlib
import logging
import uuid
from datetime import datetime, timedelta, timezone

UTC = timezone.utc
from typing import TYPE_CHECKING, Any

from sqlalchemy import text

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.appointment import Appointment
from app.models.branch import Branch
from app.models.consultation import Consultation
from app.models.doctor import Doctor, DoctorSlot
from app.models.inventory import Medicine
from app.models.invoice import Invoice
from app.models.medical_report import MedicalReport
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.payment import Payment
from app.models.prescription import Prescription, PrescriptionItem
from app.models.receptionist import Receptionist
from app.models.teleconsult import TeleConsultation
from app.models.treatment import TreatmentPlan, TreatmentProcedure
from app.models.user import User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def create_tables() -> None:
    """Create all database tables defined in models."""
    # Register all models with Base
    from app.models import (  # noqa: F401
        appointment,
        availability_request,
        branch,
        chat,
        consultation,
        doctor,
        inventory,
        invoice,
        ipd,
        medical_report,
        notification,
        patient,
        payment,
        pharmacy,
        prescription,
        receptionist,
        teleconsult,
        treatment,
        user,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Non-destructively ensure columns added in model updates exist in database
        alter_statements = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1 NOT NULL;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP WITH TIME ZONE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;",
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS admission_id UUID REFERENCES admissions(id) ON DELETE SET NULL;"
        ]
        for stmt in alter_statements:
            with contextlib.suppress(Exception):
                await conn.execute(text(stmt))
    logger.info("✅ Database tables and column migrations synchronized")


async def check_db_connection() -> bool:
    """Verify DB connectivity."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ Database connection OK")
        return True
    except Exception as exc:
        logger.error(f"❌ Database connection failed: {exc}")
        return False


async def seed_database() -> None:
    """
    Seed the database with branches, users, slots, clinical history, and medicines.
    Idempotent — checks existence before inserting. Preserves all existing data.
    """
    async with AsyncSessionLocal() as db:
        try:
            already_seeded = await _is_seeded(db)
            if already_seeded:
                logger.info("⏭️  Database already seeded (Admin exists), skipping")
                return

            logger.info("🌱 Seeding database with all clinic records...")

            # Seed the three branches (Satellite, Bopal, Navrangpura)
            branch_ids = await _seed_branches(db)

            # Seed IPD Beds
            await _seed_beds(db, branch_ids)

            # Seed users and profiles
            doctor_ids, patient_ids = await _seed_users_and_profiles(db, branch_ids)

            # Seed clinical records (appointments, consultations, prescriptions, invoices, payments, plans)
            await _seed_clinical_records(db, branch_ids, doctor_ids, patient_ids)

            # Seed medicines / inventory
            await _seed_medicines(db)

            await db.commit()
            logger.info("✅ Database fully seeded successfully")
        except Exception as e:
            await db.rollback()
            logger.warning(f"⚠️ Database seed skipped or partially executed safely without deleting existing data: {e}")


async def _is_seeded(db: AsyncSession) -> bool:
    """Check if admin user has already been seeded."""
    try:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "admin@verticalclinic.com"))
        admin = result.scalar_one_or_none()
        return admin is not None
    except Exception:
        await db.rollback()
        return False


async def _seed_branches(db: AsyncSession) -> dict[str, uuid.UUID]:
    """Create the 3 clinic branches if not existing. Returns {code: uuid}."""
    from sqlalchemy import select

    branches_data = [
        {
            "id": uuid.uuid4(),
            "name": "Satellite",
            "code": "SAT",
            "address": "2nd Floor, Shivalik Highstreet, Satellite",
            "city": "Ahmedabad",
            "phone": "+917940123456",
            "email": "satellite@suvidhadental.com",
            "gst_number": "24AACCS1234K1ZP",
            "opening_hour": "09:00",
            "closing_hour": "21:00",
            "is_active": True,
        },
        {
            "id": uuid.uuid4(),
            "name": "Bopal",
            "code": "BOP",
            "address": "Shop 12, South Bopal Circle",
            "city": "Ahmedabad",
            "phone": "+917940987654",
            "email": "bopal@suvidhadental.com",
            "gst_number": "24AACCS1234K1ZP",
            "opening_hour": "09:00",
            "closing_hour": "21:00",
            "is_active": True,
        },
        {
            "id": uuid.uuid4(),
            "name": "Navrangpura",
            "code": "NAV",
            "address": "C.G. Road, Navrangpura",
            "city": "Ahmedabad",
            "phone": "+917926461122",
            "email": "navrangpura@suvidhadental.com",
            "gst_number": "24AACCS1234K1ZP",
            "opening_hour": "09:00",
            "closing_hour": "21:00",
            "is_active": True,
        },
    ]

    branch_ids: dict[str, Any] = {}
    for data in branches_data:
        existing = await db.execute(select(Branch).where(Branch.code == data["code"]))
        b_obj = existing.scalar_one_or_none()
        if b_obj:
            branch_ids[str(data["code"])] = b_obj.id
        else:
            branch = Branch(**data)
            db.add(branch)
            branch_ids[str(data["code"])] = data["id"]

    await db.flush()
    logger.info(f"  ✅ Branches checked/created ({len(branch_ids)} active)")
    return branch_ids


async def _seed_users_and_profiles(
    db: AsyncSession, branch_ids: dict[str, uuid.UUID], test_mode: bool = False
) -> tuple[dict[str, uuid.UUID], dict[str, tuple[uuid.UUID, uuid.UUID]]]:
    """Create admins, doctors, receptionists, pharmacists, patients, and doctor slots."""
    from sqlalchemy import select

    # Create Admin if not existing
    res = await db.execute(select(User).where(User.email == "admin@verticalclinic.com"))
    if not res.scalar_one_or_none():
        admin_user = User(
            id=uuid.uuid4(),
            full_name="Admin User",
            email="admin@verticalclinic.com",
            phone="+919820000001",
            hashed_password=hash_password("Admin@verticalclinic.com"),
            role="admin",
            branch_id=None,
            is_active=True,
            is_verified=True,
        )
        db.add(admin_user)

    # Create Clinic Manager if not existing
    res = await db.execute(select(User).where(User.email == "manager@verticalclinic.com"))
    if not res.scalar_one_or_none():
        manager_user = User(
            id=uuid.uuid4(),
            full_name="Clinic Operational Manager",
            email="manager@verticalclinic.com",
            phone="+919820000005",
            hashed_password=hash_password("ManagerPassword123!"),
            role="clinic_manager",
            branch_id=branch_ids.get("SAT"),
            is_active=True,
            is_verified=True,
        )
        db.add(manager_user)

    if test_mode:
        doctors_to_seed = [
            ("Rohan Mehta", "doctor@verticalclinic.com", "+919820011111", "SAT", "Orthodontist", "BDS, MDS (Orthodontics)", 12, 900.0, "Specialist in braces, aligners, and bite correction."),
            ("Aarav Patel", "doctor2_sat@verticalclinic.com", "+919820011112", "SAT", "Pediatric Dentist", "BDS, MDS (Pedodontics)", 8, 700.0, "Specialist in pediatric dentistry and preventative care."),
            ("Vikram Shah", "doctor1_bop@verticalclinic.com", "+919820022221", "BOP", "Endodontist", "BDS, MDS (Endodontics)", 10, 800.0, "Expert in root canals, microscopic dentistry, and dental trauma."),
            ("Sneha Rao", "doctor2_bop@verticalclinic.com", "+919820022222", "BOP", "Periodontist", "BDS, MDS (Periodontics)", 9, 750.0, "Specializes in gum health, implants, and laser gum therapy."),
            ("Rajesh Nair", "doctor1_nav@verticalclinic.com", "+919820033331", "NAV", "General Dentist", "BDS", 6, 500.0, "Comprehensive dental care, cleanings, fillings, and extractions."),
            ("Anjali Desai", "doctor2_nav@verticalclinic.com", "+919820033332", "NAV", "Prosthodontist", "BDS, MDS (Prosthodontics)", 11, 850.0, "Specialist in crowns, bridges, dentures, and cosmetic restorations.")
        ]
    else:
        doctors_to_seed = [
            ("Vikram Shah", "doctor1_bopal@verticalclinic.com", "+919820022221", "BOP", "Endodontist", "BDS, MDS (Endodontics)", 10, 800.0, "Expert in root canals, microscopic dentistry, and dental trauma.")
        ]

    doctor_ids: dict[str, uuid.UUID] = {}
    for name, email, phone, branch_code, spec, qual, exp, fee, bio in doctors_to_seed:
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        if user:
            doc_res = await db.execute(select(Doctor).where(Doctor.user_id == user.id))
            doc_profile = doc_res.scalar_one_or_none()
            if doc_profile:
                doctor_ids[email] = doc_profile.id
            continue

        user = User(
            id=uuid.uuid4(),
            full_name=name,
            email=email,
            phone=phone,
            hashed_password=hash_password("Doctor1_bopal@verticalclinic.com" if email == "doctor1_bopal@verticalclinic.com" else "Doctor@verticalclinic.com"),
            role="doctor",
            branch_id=branch_ids[branch_code],
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.flush()

        import json
        default_meta = {
            "lunch_start": "13:00",
            "lunch_end": "14:00",
            "tele_start": "15:00",
            "tele_end": "17:00",
            "leaves": []
        }
        doc_profile = Doctor(
            id=uuid.uuid4(),
            user_id=user.id,
            branch_id=branch_ids[branch_code],
            specialization=spec,
            qualification=qual,
            experience_years=exp,
            consultation_fee=fee,
            rating=4.8,
            bio=bio,
            is_available=True,
            availability_metadata=json.dumps(default_meta)
        )
        db.add(doc_profile)
        await db.flush()

        # Seed weekly slots for doctor
        for w in range(6):  # Monday (0) to Saturday (5)
            slot1 = DoctorSlot(
                id=uuid.uuid4(),
                doctor_id=doc_profile.id,
                weekday=w,
                start_time="09:00",
                end_time="13:00",
                slot_duration_minutes=30,
                is_active=True
            )
            slot2 = DoctorSlot(
                id=uuid.uuid4(),
                doctor_id=doc_profile.id,
                weekday=w,
                start_time="14:00",
                end_time="21:00",
                slot_duration_minutes=30,
                is_active=True
            )
            db.add(slot1)
            db.add(slot2)

        # Seed Sunday slots (weekday 6) from 09:00 to 14:00
        slot_sunday = DoctorSlot(
            id=uuid.uuid4(),
            doctor_id=doc_profile.id,
            weekday=6,
            start_time="09:00",
            end_time="14:00",
            slot_duration_minutes=30,
            is_active=True
        )
        db.add(slot_sunday)

        doctor_ids[email] = doc_profile.id

    if test_mode:
        receptionists_to_seed = [
            ("Kavita Iyer", "receptionist@verticalclinic.com", "+919820088888", "SAT", "RC-10001", "Front desk executive specializing in patient relationships."),
            ("Preeti Sharma", "receptionist_bop@verticalclinic.com", "+919820088889", "BOP", "RC-10002", "Senior receptionist with 5+ years of clinical scheduling experience."),
            ("Neha Gupta", "receptionist_nav@verticalclinic.com", "+919820088890", "NAV", "RC-10003", "Bilingual customer relation officer and coordinator.")
        ]
    else:
        receptionists_to_seed = [
            ("Preeti Sharma", "receptionist1_bopal@verticalclinic.com", "+919820088889", "BOP", "RC-10002", "Senior receptionist with 5+ years of clinical scheduling experience.")
        ]
    for name, email, phone, branch_code, emp_id, bio in receptionists_to_seed:
        res = await db.execute(select(User).where(User.email == email))
        if res.scalar_one_or_none():
            continue

        user = User(
            id=uuid.uuid4(),
            full_name=name,
            email=email,
            phone=phone,
            hashed_password=hash_password("Receptionist1_bopal@verticalclinic.com" if email == "receptionist1_bopal@verticalclinic.com" else "Receptionist@123"),
            role="receptionist",
            branch_id=branch_ids[branch_code],
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.flush()

        recep_profile = Receptionist(
            id=uuid.uuid4(),
            user_id=user.id,
            employee_id=emp_id,
            branch_id=branch_ids[branch_code],
            shift_start="09:00",
            shift_end="17:00",
            bio=bio,
            is_active=True
        )
        db.add(recep_profile)

    if test_mode:
        pharmacists_to_seed = [
            ("Meera Iyer", "pharmacist@verticalclinic.com", "+919820066666", "SAT"),
            ("Ravi Kumar", "pharmacist_bop@verticalclinic.com", "+919820066667", "BOP"),
            ("Amit Patel", "pharmacist_nav@verticalclinic.com", "+919820066668", "NAV")
        ]
    else:
        pharmacists_to_seed = [
            ("Ravi Kumar", "pharma1_bopal@verticalclinic.com", "+919820066667", "BOP")
        ]
    for name, email, phone, branch_code in pharmacists_to_seed:
        res = await db.execute(select(User).where(User.email == email))
        if res.scalar_one_or_none():
            continue

        user = User(
            id=uuid.uuid4(),
            full_name=name,
            email=email,
            phone=phone,
            hashed_password=hash_password("Pharma1_bopal@verticalclinic.com" if email == "pharma1_bopal@verticalclinic.com" else "Pharmacist@verticalclinic.com"),
            role="pharmacist",
            branch_id=branch_ids[branch_code],
            is_active=True,
            is_verified=True,
        )
        db.add(user)

    if test_mode:
        patients_to_seed = [
            ("Priya Sharma", "patient@verticalclinic.com", "+919825011234", "SAT", "PT-10001", "F", "O+", "Penicillin"),
            ("Aarav Nair", "aarav@example.com", "+919825011235", "SAT", "PT-10002", "M", "A+", "None"),
            ("Rohan Deshmukh", "patient_bop@verticalclinic.com", "+919825011236", "BOP", "PT-10003", "M", "B+", "None"),
            ("Ananya Patel", "ananya_bop@example.com", "+919825011237", "BOP", "PT-10004", "F", "O-", "Aspirin"),
            ("Komal Patel", "patient_nav@verticalclinic.com", "+919825011238", "NAV", "PT-10005", "F", "AB+", "Latex"),
            ("Dev Shah", "dev_nav@example.com", "+919825011239", "NAV", "PT-10006", "M", "B-", "None")
        ]
    else:
        patients_to_seed = [
            ("Rohan Deshmukh", "patient1_bopal@verticalclinic.com", "+919825011236", "BOP", "PT-10003", "M", "B+", "None"),
            ("Ananya Patel", "patient2_bopal@verticalclinic.com", "+919825011237", "BOP", "PT-10004", "F", "O-", "Aspirin")
        ]

    patient_ids: dict[str, tuple[uuid.UUID, uuid.UUID]] = {}
    for name, email, phone, branch_code, pat_code, gender, blood, allergies in patients_to_seed:
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        if user:
            pat_res = await db.execute(select(Patient).where(Patient.user_id == user.id))
            pat_profile = pat_res.scalar_one_or_none()
            if pat_profile:
                patient_ids[email] = (pat_profile.id, user.id)
            continue

        user = User(
            id=uuid.uuid4(),
            full_name=name,
            email=email,
            phone=phone,
            hashed_password=hash_password("Patient1_bopal@verticalclinic.com" if "patient1_bopal" in email else ("Patient2_bopal@verticalclinic.com" if "patient2_bopal" in email else "Patient@verticalclinic.com")),
            role="patient",
            branch_id=branch_ids[branch_code],
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.flush()

        pat_profile = Patient(
            id=uuid.uuid4(),
            user_id=user.id,
            patient_code=pat_code,
            gender=gender,
            blood_group=blood,
            allergies=allergies,
            preferred_branch_id=branch_ids[branch_code],
            is_active=True
        )
        db.add(pat_profile)
        patient_ids[email] = (pat_profile.id, user.id)

    await db.flush()
    logger.info("  ✅ Admin, Doctors, Receptionists, Pharmacists, Patients, and doctor slots seeded")
    return doctor_ids, patient_ids


async def _seed_clinical_records(
    db: AsyncSession,
    branch_ids: dict[str, uuid.UUID],
    doctor_ids: dict[str, uuid.UUID],
    patient_ids: dict[str, tuple[uuid.UUID, uuid.UUID]]
) -> None:
    """Seed appointments, consultations, prescriptions, treatment plans, medical reports, invoices, and payments."""
    from sqlalchemy import select

    # Skip if clinical records are already seeded
    existing_appt = await db.execute(select(Appointment).limit(1))
    if existing_appt.scalar_one_or_none() is not None:
        logger.info("  ⏭️ Clinical records already exist in database, skipping")
        return

    today = datetime.now(UTC)
    today_date = today.date()

    # Define primary mappings for comprehensive clinical records
    branch_mappings = [
        {
            "branch_code": "BOP",
            "doc_email": "doctor1_bopal@verticalclinic.com",
            "pat_email": "patient1_bopal@verticalclinic.com",
            "treatments": [
                {
                    "title": "Root Canal & Crown Therapy",
                    "total_cost": 15000.00,
                    "notes": "Complete cleaning, shaping, and obduration followed by porcelain crown.",
                    "procedures": [
                        ("Pulpectomy and Debridement", 3000.00, "completed", "Access cavity prepared, infected pulp removed."),
                        ("Canal Obturation & Temporary Restoration", 5000.00, "completed", "Gutta-percha obturation verified on radiograph."),
                        ("Porcelain Fused to Metal Crown Placement", 7000.00, "in_progress", "Crown preparation complete. Fabrication in lab.")
                    ]
                }
            ],
            "consult_symptoms": "Severe continuous throbbing pain on right upper jaw.",
            "consult_diagnosis": "Irreversible acute pulpitis on tooth #16 with apical periodontitis.",
            "consult_notes": "Prescribed antibiotic coverage and scheduled immediate root canal therapy."
        }
    ]

    all_doctor_keys = list(doctor_ids.keys())

    # Create 4 appointments today for every doctor (4 appointments in total)
    for doc_email in all_doctor_keys:
        doc_id = doctor_ids[doc_email]
        branch_code = "BOP"
        pat_emails = ["patient1_bopal@verticalclinic.com", "patient2_bopal@verticalclinic.com"]

        branch_id = branch_ids[branch_code]
        pat_id_1 = patient_ids[pat_emails[0]][0]
        pat_id_2 = patient_ids[pat_emails[1]][0]

        appts = [
            {
                "patient_id": pat_id_1,
                "doctor_id": doc_id,
                "branch_id": branch_id,
                "appointment_datetime": datetime.combine(today_date, datetime.min.time(), tzinfo=UTC) + timedelta(hours=9, minutes=30),
                "treatment_type": "Routine Checkup",
                "consultation_type": "in_person",
                "status": "checked_in",
                "notes": "First checkup of the day"
            },
            {
                "patient_id": pat_id_2,
                "doctor_id": doc_id,
                "branch_id": branch_id,
                "appointment_datetime": datetime.combine(today_date, datetime.min.time(), tzinfo=UTC) + timedelta(hours=11, minutes=0),
                "treatment_type": "Consultation",
                "consultation_type": "in_person",
                "status": "confirmed",
                "notes": "Orthodontic monthly follow-up"
            },
            {
                "patient_id": pat_id_1,
                "doctor_id": doc_id,
                "branch_id": branch_id,
                "appointment_datetime": datetime.combine(today_date, datetime.min.time(), tzinfo=UTC) + timedelta(hours=14, minutes=30),
                "treatment_type": "Scaling & Polishing",
                "consultation_type": "teleconsultation",
                "status": "checked_in",
                "notes": "Requires online consultation first"
            },
            {
                "patient_id": pat_id_2,
                "doctor_id": doc_id,
                "branch_id": branch_id,
                "appointment_datetime": datetime.combine(today_date, datetime.min.time(), tzinfo=UTC) + timedelta(hours=16, minutes=0),
                "treatment_type": "Tooth Extraction",
                "consultation_type": "in_person",
                "status": "pending",
                "notes": "Decayed molar"
            }
        ]

        for appt_data in appts:
            appt = Appointment(id=uuid.uuid4(), **appt_data)
            db.add(appt)
            await db.flush()

            # Link teleconsult link if checked_in + teleconsultation
            if appt.status == "checked_in" and appt.consultation_type == "teleconsultation":
                tele = TeleConsultation(
                    id=uuid.uuid4(),
                    appointment_id=appt.id,
                    meeting_url=f"https://meet.jit.si/VerticalClinicConsultation_{appt.id}",
                    start_time=today - timedelta(hours=1),
                    end_time=today + timedelta(hours=1),
                    expiry_time=today + timedelta(hours=2),
                    status="Ready",
                    meeting_link_sent=True
                )
                db.add(tele)

    # Seed clinical history records
    for m in branch_mappings:
        branch_code = m["branch_code"]
        branch_id = branch_ids[branch_code]
        doc_id = doctor_ids[m["doc_email"]]
        pat_id = patient_ids[m["pat_email"]][0]
        pat_user_id = patient_ids[m["pat_email"]][1]

        # 1. Past Consultations
        c1 = Consultation(
            id=uuid.uuid4(),
            patient_id=pat_id,
            doctor_id=doc_id,
            branch_id=branch_id,
            consultation_datetime=today - timedelta(days=15),
            symptoms=m["consult_symptoms"],
            diagnosis=m["consult_diagnosis"],
            notes=m["consult_notes"],
            vitals_bp="118/76",
            vitals_pulse=72,
            vitals_temperature=98.4
        )
        db.add(c1)
        await db.flush()

        c2 = Consultation(
            id=uuid.uuid4(),
            patient_id=pat_id,
            doctor_id=doc_id,
            branch_id=branch_id,
            consultation_datetime=today - timedelta(days=5),
            symptoms="Follow-up clinical assessment",
            diagnosis="Healing and progress as expected.",
            notes="No secondary infection. Standard recovery noted.",
            vitals_bp="120/80",
            vitals_pulse=70,
            vitals_temperature=98.6
        )
        db.add(c2)
        await db.flush()

        # 2. Prescriptions
        p1 = Prescription(
            id=uuid.uuid4(),
            consultation_id=c1.id,
            patient_id=pat_id,
            doctor_id=doc_id,
            notes="Take medicines strictly after meals. Maintain oral hygiene.",
            status="Active"
        )
        db.add(p1)
        await db.flush()

        pi1 = PrescriptionItem(
            id=uuid.uuid4(),
            prescription_id=p1.id,
            medicine_name="Amoxicillin 500mg",
            dosage="1-0-1",
            duration="5 days",
            instructions="After food"
        )
        pi2 = PrescriptionItem(
            id=uuid.uuid4(),
            prescription_id=p1.id,
            medicine_name="Ibuprofen 400mg",
            dosage="1-0-1",
            duration="3 days",
            instructions="After food, only if pain persists"
        )
        db.add(pi1)
        db.add(pi2)

        # 3. Medical Reports
        r1 = MedicalReport(
            id=uuid.uuid4(),
            patient_id=pat_id,
            report_type="X-Ray",
            report_name=f"Panoramic Dental OPG - {branch_code}",
            file_url="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        )
        db.add(r1)

        # 4. Invoices & Payments
        # Invoice 1 (Paid)
        inv1 = Invoice(
            id=uuid.uuid4(),
            patient_id=pat_id,
            consultation_id=c1.id,
            invoice_number=f"INV-2026-{branch_code}-0001",
            total_amount=1200.00,
            discount_amount=100.00,
            tax_amount=198.00,
            grand_total=1298.00,
            amount_paid=1298.00,
            balance_due=0.00,
            status="paid"
        )
        db.add(inv1)
        await db.flush()

        pay1 = Payment(
            id=uuid.uuid4(),
            invoice_id=inv1.id,
            patient_id=pat_id,
            payment_number=f"PAY-2026-{branch_code}-0001",
            amount=1298.00,
            payment_method="cash",
            payment_status="completed",
            transaction_reference="TXN-982104"
        )
        db.add(pay1)

        # Invoice 2 (Partially Paid)
        inv2 = Invoice(
            id=uuid.uuid4(),
            patient_id=pat_id,
            consultation_id=c2.id,
            invoice_number=f"INV-2026-{branch_code}-0002",
            total_amount=2500.00,
            discount_amount=0.00,
            tax_amount=450.00,
            grand_total=2950.00,
            amount_paid=1000.00,
            balance_due=1950.00,
            status="partially_paid"
        )
        db.add(inv2)
        await db.flush()

        pay2 = Payment(
            id=uuid.uuid4(),
            invoice_id=inv2.id,
            patient_id=pat_id,
            payment_number=f"PAY-2026-{branch_code}-0002",
            amount=1000.00,
            payment_method="card",
            payment_status="completed",
            transaction_reference="TXN-982105"
        )
        db.add(pay2)

        # 5. Treatment Plans & Procedures
        for tp_data in m["treatments"]:
            tp = TreatmentPlan(
                id=uuid.uuid4(),
                patient_id=pat_id,
                doctor_id=doc_id,
                title=tp_data["title"],
                status="active",
                total_cost=tp_data["total_cost"],
                notes=tp_data["notes"]
            )
            db.add(tp)
            await db.flush()

            for proc_name, cost, status, notes in tp_data["procedures"]:
                proc = TreatmentProcedure(
                    id=uuid.uuid4(),
                    treatment_plan_id=tp.id,
                    procedure_name=proc_name,
                    cost=cost,
                    status=status,
                    notes=notes
                )
                db.add(proc)

        # 6. Notifications
        n = Notification(
            id=uuid.uuid4(),
            user_id=pat_user_id,
            title="Welcome to Clinic OS",
            message=f"Your profile has been created successfully at {branch_code} branch.",
            type="info",
            is_read=False
        )
        db.add(n)

    await db.flush()
    logger.info("  ✅ Clinical consultations, prescriptions, invoices, payments, plans and notifications seeded")


async def _seed_medicines(db: AsyncSession) -> None:
    """Seed initial medicine/inventory catalogue."""

    medicines = [
        {
            "name": "Amoxicillin 500mg",
            "category": "Antibiotic",
            "stock_qty": 240,
            "reorder_level": 100,
            "unit": "Capsules",
            "unit_price": 8.50,
            "supplier": "Cipla Ltd.",
            "hsn_code": "30041010",
        },
        {
            "name": "Ibuprofen 400mg",
            "category": "Analgesic",
            "stock_qty": 55,
            "reorder_level": 80,
            "unit": "Tablets",
            "unit_price": 3.20,
            "supplier": "Sun Pharma",
            "hsn_code": "30049099",
        },
        {
            "name": "Paracetamol 650mg",
            "category": "Analgesic",
            "stock_qty": 320,
            "reorder_level": 120,
            "unit": "Tablets",
            "unit_price": 2.10,
            "supplier": "GSK",
            "hsn_code": "30049099",
        },
        {
            "name": "Chlorhexidine Mouthwash 100ml",
            "category": "Antiseptic",
            "stock_qty": 18,
            "reorder_level": 40,
            "unit": "Bottles",
            "unit_price": 95.00,
            "supplier": "ICPA Health",
            "hsn_code": "33061000",
        },
        {
            "name": "Diclofenac 50mg",
            "category": "Analgesic",
            "stock_qty": 150,
            "reorder_level": 60,
            "unit": "Tablets",
            "unit_price": 4.75,
            "supplier": "Cipla Ltd.",
            "hsn_code": "30049099",
        },
        {
            "name": "Metronidazole 400mg",
            "category": "Antibiotic",
            "stock_qty": 180,
            "reorder_level": 80,
            "unit": "Tablets",
            "unit_price": 5.50,
            "supplier": "Sun Pharma",
            "hsn_code": "30041010",
        },
        {
            "name": "Lignocaine 2% Injection",
            "category": "Local Anesthetic",
            "stock_qty": 90,
            "reorder_level": 30,
            "unit": "Vials",
            "unit_price": 45.00,
            "supplier": "AstraZeneca",
            "hsn_code": "30041020",
        },
    ]

    from sqlalchemy import select
    for med in medicines:
        res = await db.execute(select(Medicine).where(Medicine.name == med["name"]))
        if res.scalar_one_or_none():
            continue
        m = Medicine(id=uuid.uuid4(), **med)
        db.add(m)

    await db.flush()
    logger.info(f"  ✅ {len(medicines)} medicines seeded")


async def _seed_beds(db: AsyncSession, branch_ids: dict[str, uuid.UUID]) -> None:
    """Seed bed categories and physical beds for each branch."""
    from sqlalchemy import select, update

    from app.models.ipd import Bed, BedCategory

    categories = [
        {"name": "General Ward", "base_charge_24h": 1200.0, "hourly_overtime_rate": 50.0, "tax_rate": 0.05},
        {"name": "Private Deluxe", "base_charge_24h": 3500.0, "hourly_overtime_rate": 150.0, "tax_rate": 0.05},
        {"name": "ICU", "base_charge_24h": 5000.0, "hourly_overtime_rate": 250.0, "tax_rate": 0.12},
    ]

    cat_map = {}
    for cat_data in categories:
        res = await db.execute(select(BedCategory).where(BedCategory.name == cat_data["name"]))
        cat = res.scalar_one_or_none()
        if not cat:
            cat = BedCategory(id=uuid.uuid4(), **cat_data)
            db.add(cat)
            await db.flush()
        cat_map[cat_data["name"]] = cat.id

    for _code, branch_id in branch_ids.items():
        # Pre-migration: rename old default names if they exist to the new abbreviated format
        # This keeps integrity with existing transactions/admissions
        rename_pairs = [
            ("Bed-01", "GW-01"),
            ("Bed-02", "GW-02"),
            ("Bed-03", "DL-101"),
            ("Bed-04", "ICU-101"),
        ]
        for old_num, new_num in rename_pairs:
            await db.execute(
                update(Bed)
                .where(Bed.branch_id == branch_id, Bed.bed_number == old_num)
                .values(bed_number=new_num)
            )
        await db.flush()

        beds = [
            {"bed_number": "GW-01", "category_id": cat_map["General Ward"]},
            {"bed_number": "GW-02", "category_id": cat_map["General Ward"]},
            {"bed_number": "DL-101", "category_id": cat_map["Private Deluxe"]},
            {"bed_number": "ICU-101", "category_id": cat_map["ICU"]},
        ]
        for bed_data in beds:
            res = await db.execute(select(Bed).where(Bed.branch_id == branch_id, Bed.bed_number == bed_data["bed_number"]))
            bed = res.scalar_one_or_none()
            if not bed:
                bed = Bed(id=uuid.uuid4(), branch_id=branch_id, status="available", **bed_data)
                db.add(bed)
    await db.flush()
    logger.info("  ✅ IPD Bed categories and Bed assets seeded")
