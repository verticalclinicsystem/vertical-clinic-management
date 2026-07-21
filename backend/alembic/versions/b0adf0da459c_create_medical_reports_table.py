"""create_medical_reports_table

Revision ID: b0adf0da459c
Revises: 2119844de640
Create Date: 2026-07-13 12:55:32.880672

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0adf0da459c'
down_revision: Union[str, None] = '2119844de640'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'medical_reports',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('report_type', sa.String(length=50), nullable=False),
        sa.Column('report_name', sa.String(length=250), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_medical_reports_patient_id'), 'medical_reports', ['patient_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_medical_reports_patient_id'), table_name='medical_reports')
    op.drop_table('medical_reports')
