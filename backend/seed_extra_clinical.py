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
            title="Full Mouth Orthodontic Alignment",
            status="active",
            total_cost=25000.00,
            notes="Treatment expected to take 12-18 months. Patient to wear elastic bands."
        )
        db.add(tp)
        await db.flush()

        # Procedures
        proc1 = TreatmentProcedure(
            id=uuid.uuid4(),
            treatment_plan_id=tp.id,
            procedure_name="Diagnostic Models & OPG",
            cost=1500.00,
            status="completed",
            notes="OPG taken and dental casts prepared."
        )
        proc2 = TreatmentProcedure(
            id=uuid.uuid4(),
            treatment_plan_id=tp.id,
            procedure_name="Bonding Upper & Lower Arches",
            cost=12000.00,
            status="completed",
            notes="Metal brackets bonded."
        )
        proc3 = TreatmentProcedure(
            id=uuid.uuid4(),
            treatment_plan_id=tp.id,
            procedure_name="Monthly Wire Changes & Elastics",
            cost=11500.00,
            status="in_progress",
            notes="Scheduled adjustments."
        )
        db.add(proc1)
        db.add(proc2)
        db.add(proc3)

        # 2. Notifications
        n1 = Notification(
            id=uuid.uuid4(),
            user_id=patient.user_id,
            title="Upcoming Checkup Reminder",
            message="Hi Priya, this is a reminder for your dental checkup today at 11:00 AM.",
            type="appointment",
            is_read=False
        )
        n2 = Notification(
            id=uuid.uuid4(),
            user_id=patient.user_id,
            title="Invoice Generated",
            message="Invoice INV-2026-0002 has been generated for your recent braces checkup.",
            type="billing",
            is_read=True
        )
        db.add(n1)
        db.add(n2)

        await db.commit()
        print("Successfully seeded Treatment Plans and Notifications!")

if __name__ == "__main__":
    asyncio.run(seed())
