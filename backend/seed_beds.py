import asyncio
from app.db.session import AsyncSessionLocal
from app.db.init_db import _seed_branches, _seed_beds

async def seed():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding branches...")
        branch_ids = await _seed_branches(db)
        print("🌱 Seeding beds...")
        await _seed_beds(db, branch_ids)
        await db.commit()
        print("✅ Bed categories and bed assets seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
