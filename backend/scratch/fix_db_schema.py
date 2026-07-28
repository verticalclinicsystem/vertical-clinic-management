import asyncio
import sys
import os

# Add backend root to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.db.session import engine
from sqlalchemy import text

async def run_fix():
    print("Connecting to DB to apply missing columns...")
    async with engine.begin() as conn:
        print("Adding height column if not exists...")
        await conn.execute(text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS height VARCHAR(20);"))
        
        print("Adding weight column if not exists...")
        await conn.execute(text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS weight VARCHAR(20);"))
        
        print("Adding is_profile_completed column if not exists...")
        await conn.execute(text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_profile_completed BOOLEAN NOT NULL DEFAULT FALSE;"))
        
        print("Adding current_treatment_details column if not exists...")
        await conn.execute(text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_treatment_details TEXT;"))
        
        print("Adding avatar_url column to users if not exists...")
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;"))

        print("Checking/creating otp_records table...")
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE otp_purpose AS ENUM ('verify', 'reset');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS otp_records (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email       VARCHAR(255) NOT NULL,
                code        VARCHAR(10) NOT NULL,
                purpose     otp_purpose NOT NULL,
                attempts    INTEGER NOT NULL DEFAULT 0,
                is_used     BOOLEAN NOT NULL DEFAULT FALSE,
                expires_at  TIMESTAMPTZ NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_otp_records_email ON otp_records (email);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_otp_records_purpose ON otp_records (purpose);"))

    print("DATABASE COLUMNS FIX COMPLETED SUCCESSFULLY!")

if __name__ == '__main__':
    asyncio.run(run_fix())
