import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.core.security import hash_password

async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.email == "kartikk.brainerhub@gmail.com"))
        user = res.scalar_one_or_none()
        if user:
            user.hashed_password = hash_password("Password@123")
            await session.commit()
            print("Password updated successfully for kartikk.brainerhub@gmail.com")
        else:
            print("User not found")

if __name__ == "__main__":
    asyncio.run(main())
