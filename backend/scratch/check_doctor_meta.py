import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.doctor import Doctor
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as db:
        stmt = select(Doctor).join(User).where(User.full_name.like("%Vikram%"))
        res = await db.execute(stmt)
        doctor = res.scalar_one_or_none()
        if doctor:
            print(f"Doctor: {doctor.user.full_name}")
            print(f"availability_metadata: {doctor.availability_metadata}")
        else:
            print("Doctor not found")

if __name__ == "__main__":
    asyncio.run(main())
