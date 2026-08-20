import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from app.db.session import AsyncSessionLocal
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.treatment import TreatmentPlan, TreatmentProcedure
from app.models.notification import Notification
from sqlalchemy import select

async def seed():
    async with AsyncSessionLocal() as db:
        # Find doctor
        doc_stmt = select(Doctor)
        doc_res = await db.execute(doc_stmt)
        doctor = doc_res.scalars().first()
        if not doctor:
            print("No doctor found!")
            return

        # Find patient
        pat_stmt = select(Patient)
        pat_res = await db.execute(pat_stmt)
        patient = pat_res.scalars().first()
        if not patient:
            print("No patient found!")
            return

        print(f"Seeding Treatment Plan & Notifications for Patient: {patient.patient_code}")

        # 1. Treatment Plan
        tp = TreatmentPlan(
            id=uuid.uuid4(),
            patient_id=patient.id,
            doctor_id=doctor.id,
            title="Hypertension & Cardiovascular Wellness Plan",
            status="active",
            total_cost=4500.00,
            notes="Comprehensive 6-month blood pressure control & lipid management plan."
        )
        db.add(tp)
        await db.flush()

        # Procedures
        proc1 = TreatmentProcedure(
            id=uuid.uuid4(),
            treatment_plan_id=tp.id,
            procedure_name="Cardiovascular Risk Assessment & ECG",
            cost=1500.00,
            status="completed",
            notes="12-lead ECG completed. Normal sinus rhythm."
        )
        proc2 = TreatmentProcedure(
            id=uuid.uuid4(),
            treatment_plan_id=tp.id,
            procedure_name="Comprehensive Lipid & Blood Panel",
            cost=1500.00,
            status="completed",
            notes="Fasting lipid profile and HbA1c panel completed."
        )
        proc3 = TreatmentProcedure(
            id=uuid.uuid4(),
            treatment_plan_id=tp.id,
            procedure_name="Monthly BP & Lifestyle Monitoring",
            cost=1500.00,
            status="in_progress",
            notes="Scheduled monthly BP monitoring."
        )
        db.add(proc1)
        db.add(proc2)
        db.add(proc3)

        # 2. Notifications
        n1 = Notification(
            id=uuid.uuid4(),
            user_id=patient.user_id,
            title="Upcoming Checkup Reminder",
            message="Hi Priya, this is a reminder for your medical health checkup today at 11:00 AM.",
            type="appointment",
            is_read=False
        )
        n2 = Notification(
            id=uuid.uuid4(),
            user_id=patient.user_id,
            title="Invoice Generated",
            message="Invoice INV-2026-0002 has been generated for your recent health consultation.",
            type="billing",
            is_read=True
        )
        db.add(n1)
        db.add(n2)

        await db.commit()
        print("Successfully seeded Treatment Plans and Notifications!")

if __name__ == "__main__":
    asyncio.run(seed())
