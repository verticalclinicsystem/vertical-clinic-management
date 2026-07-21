import asyncio
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.appointment import Appointment
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        # Users
        users = (await db.execute(select(User))).scalars().all()
        print("--- USERS ---")
        for u in users:
            print(f"ID: {u.id} | Email: {u.email} | Name: {u.full_name} | Role: {u.role}")

        # Doctors
        doctors = (await db.execute(select(Doctor))).scalars().all()
        print("\n--- DOCTORS ---")
        for d in doctors:
            print(f"ID: {d.id} | UserID: {d.user_id} | Specialization: {d.specialization}")

        # Patients
        patients = (await db.execute(select(Patient))).scalars().all()
        print("\n--- PATIENTS ---")
        for p in patients:
            print(f"ID: {p.id} | UserID: {p.user_id} | Code: {p.patient_code}")

        # Appointments
        appointments = (await db.execute(select(Appointment))).scalars().all()
        print("\n--- APPOINTMENTS ---")
        for a in appointments:
            print(f"ID: {a.id} | DoctorID: {a.doctor_id} | PatientID: {a.patient_id} | Time: {a.appointment_datetime} | Status: {a.status}")

if __name__ == "__main__":
    asyncio.run(main())
