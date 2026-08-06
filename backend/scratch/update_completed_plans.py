import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.db.session import engine
from sqlalchemy import text

async def update_plans():
    async with engine.begin() as conn:
        print("Updating active treatment plans whose procedures are 100% completed...")
        await conn.execute(text("""
            UPDATE treatment_plans
            SET status = 'completed'
            WHERE id IN (
                SELECT tp.id
                FROM treatment_plans tp
                JOIN treatment_procedures proc ON proc.treatment_plan_id = tp.id
                GROUP BY tp.id
                HAVING COUNT(proc.id) > 0 AND COUNT(CASE WHEN proc.status != 'completed' THEN 1 END) = 0
            );
        """))
        print("Successfully updated 100% completed treatment plans to status = 'completed'!")

if __name__ == '__main__':
    asyncio.run(update_plans())
