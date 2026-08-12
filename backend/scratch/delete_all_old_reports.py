import asyncio
from sqlalchemy import select, delete
from app.db.session import AsyncSessionLocal
from app.models.medical_report import MedicalReport

async def delete_old_reports():
    async with AsyncSessionLocal() as db:
        try:
            # Delete all reports pointing to the old cloud ohlztt2b
            result = await db.execute(select(MedicalReport))
            reports = result.scalars().all()
            deleted_count = 0
            for r in reports:
                if "ohlztt2b" in r.file_url:
                    await db.delete(r)
                    deleted_count += 1
            await db.commit()
            print(f"Successfully deleted {deleted_count} old medical reports from database.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(delete_old_reports())
