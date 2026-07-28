"""add_otp_records_table_and_avatar_url_to_users

Revision ID: eeef5f49c5a4
Revises: 
Create Date: 2026-07-10 10:55:22.697653

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = 'eeef5f49c5a4'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Add avatar_url column to users table ──────────────────────────────────
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;")

    # ── Create otp_records table (raw SQL to avoid enum re-creation) ──────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE otp_purpose AS ENUM ('verify', 'reset');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS otp_records (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email       VARCHAR(255) NOT NULL,
            code        VARCHAR(10) NOT NULL,
            purpose     otp_purpose NOT NULL,
            attempts    INTEGER NOT NULL DEFAULT 0,
            is_used     BOOLEAN NOT NULL DEFAULT FALSE,
            expires_at  TIMESTAMPTZ NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_otp_records_email ON otp_records (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_otp_records_purpose ON otp_records (purpose)")


def downgrade() -> None:
    # ── Drop otp_records table ────────────────────────────────────────────────
    op.drop_index('ix_otp_records_purpose', table_name='otp_records')
    op.drop_index('ix_otp_records_email', table_name='otp_records')
    op.drop_table('otp_records')
    op.execute("DROP TYPE IF EXISTS otp_purpose")

    # ── Remove avatar_url column from users ───────────────────────────────────
    op.drop_column('users', 'avatar_url')

