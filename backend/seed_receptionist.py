import asyncio
import uuid
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.receptionist import Receptionist
from app.core.security import hash_password
from sqlalchemy import select
from app.models.branch import Branch
from app.repositories.receptionist_repo import ReceptionistRepository

async def seed():
    async with AsyncSessionLocal() as db:
        # Find Satellite branch
        branch_stmt = select(Branch).filter(Branch.code == "SAT")
        branch_res = await db.execute(branch_stmt)
        branch = branch_res.scalars().first()
        if not branch:
            print("No branch found!")
            return

        # Check if receptionist user already exists
        check_stmt = select(User).filter(User.email == "receptionist@verticalclinic.com")
        check_res = await db.execute(check_stmt)
        user = check_res.scalars().first()
        
        if not user:
            user = User(
                id=uuid.uuid4(),
                full_name="Kavita Iyer",
                email="receptionist@verticalclinic.com",
                phone="+919820088888",
                hashed_password=hash_password("Receptionist@123"),
                role="receptionist",
                branch_id=branch.id,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()
            print("Seeded user receptionist@verticalclinic.com")
        else:
            print("Receptionist user already exists.")

        # Check/create receptionist profile
        recep_stmt = select(Receptionist).filter(Receptionist.user_id == user.id)
        recep_res = await db.execute(recep_stmt)
        profile = recep_res.scalars().first()

        if not profile:
            recep_repo = ReceptionistRepository(db)
            profile = await recep_repo.create_for_user(
                user_id=user.id,
                branch_id=branch.id,
                shift_start="09:00",
                shift_end="17:00",
                bio="Front desk executive specializing in patient relationships."
            )
            print("Seeded Receptionist profile.")
        else:
            print("Receptionist profile already exists.")

        await db.commit()
        print("Successfully seeded receptionist user and profile: receptionist@verticalclinic.com / Receptionist@123")

if __name__ == "__main__":
    asyncio.run(seed())
