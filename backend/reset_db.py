import asyncio
import logging
from app.db.base import Base
from app.db.session import engine
from app.db.init_db import create_tables, seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    # Import all models to ensure they are registered with Base
    from app.models import (
        appointment,
        branch,
        consultation,
        doctor,
        inventory,
        invoice,
        medical_report,
        notification,
        patient,
        payment,
        pharmacy,
        prescription,
        teleconsult,
        treatment,
        user,
    )
    
    logger.info("Dropping all existing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    logger.info("✅ All tables dropped.")

    logger.info("Creating new database tables...")
    await create_tables()

    logger.info("Seeding database with clinical, patient, and staff records...")
    await seed_database()
    logger.info("✅ Database reset and seeded successfully!")

if __name__ == "__main__":
    asyncio.run(main())
