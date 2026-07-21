import asyncio
import logging
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def clear_data():
    async with AsyncSessionLocal() as db:
        logger.info("Cleaning up all clinical and transaction records...")
        
        # Table names to truncate/delete from in order of dependency
        tables = [
            "payments",
            "invoices",
            "prescription_items",
            "prescriptions",
            "tele_consultations",
            "appointments",
            "treatment_procedures",
            "treatment_plans",
            "medical_reports",
            "notifications",
            "medicines",
            "doctor_slots",
            "receptionists",
            "doctors",
            "patients",
        ]
        
        for table in tables:
            try:
                await db.execute(text(f"DELETE FROM {table}"))
                logger.info(f"  Deleted all records from {table}")
            except Exception as e:
                logger.warning(f"  Could not delete from {table}: {e}")
        
        logger.info("Deleting all non-admin users...")
        try:
            await db.execute(text("DELETE FROM users WHERE role != 'admin'"))
            logger.info("  Deleted all non-admin users.")
        except Exception as e:
            logger.error(f"  Error deleting non-admin users: {e}")
            
        await db.commit()
        logger.info("✅ Database successfully cleared! Only admin and branches remain.")

if __name__ == "__main__":
    asyncio.run(clear_data())
