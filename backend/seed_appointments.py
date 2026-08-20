import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from app.db.session import AsyncSessionLocal
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.appointment import Appointment
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

        print(f"Found Doctor ID: {doctor.id}, Patient ID: {patient.id}, Branch ID: {doctor.branch_id}")

        today = datetime.now(timezone.utc).date()
        
        # We will create 4 appointments for today
        appointments = [
            {
                "patient_id": patient.id,
                "doctor_id": doctor.id,
                "branch_id": doctor.branch_id,
                "appointment_datetime": datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=9, minutes=30),
                "treatment_type": "Routine Checkup",
                "consultation_type": "in_person",
                "status": "checked_in",
                "notes": "First checkup of the day"
            },
            {
                "patient_id": patient.id,
                "doctor_id": doctor.id,
                "branch_id": doctor.branch_id,
                "appointment_datetime": datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=11, minutes=0),
                "treatment_type": "Cardiology Evaluation",
                "consultation_type": "in_person",
                "status": "confirmed",
                "notes": "Cardiology monthly follow-up"
            },
            {
                "patient_id": patient.id,
                "doctor_id": doctor.id,
                "branch_id": doctor.branch_id,
                "appointment_datetime": datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=14, minutes=30),
                "treatment_type": "General Consultation",
                "consultation_type": "teleconsultation",
                "status": "checked_in",
                "notes": "Requires online consultation first"
            },
            {
                "patient_id": patient.id,
                "doctor_id": doctor.id,
                "branch_id": doctor.branch_id,
                "appointment_datetime": datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=16, minutes=0),
                "treatment_type": "Health Monitoring Panel",
                "consultation_type": "in_person",
                "status": "pending",
                "notes": "Routine wellness review"
            }
        ]

        for appt_data in appointments:
            appt = Appointment(id=uuid.uuid4(), **appt_data)
            db.add(appt)
            
        await db.commit()
        print("Successfully seeded today's appointments for testing!")

if __name__ == "__main__":
    asyncio.run(seed())
