import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.patient import Patient
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as db:
        stmt = select(Patient).join(User).where(User.email == "kartikk.brainerhub@gmail.com")
        res = await db.execute(stmt)
        patient = res.scalar_one_or_none()
        if patient:
            print(f"Patient ID: {patient.id}")
            print(f"Code: {patient.patient_code}")
            print(f"is_profile_completed: {patient.is_profile_completed}")
            print(f"height: {patient.height}")
            print(f"weight: {patient.weight}")
            print(f"chronic_conditions: {patient.chronic_conditions}")
        else:
            print("Patient not found")

if __name__ == "__main__":
    asyncio.run(main())
