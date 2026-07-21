"""create_consultations_prescriptions_treatment_plans

Revision ID: 689ddcda500a
Revises: aa6ea75647ed
Create Date: 2026-07-13 11:11:03.577560

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '689ddcda500a'
down_revision: Union[str, None] = 'aa6ea75647ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. create consultations table
    op.create_table(
        'consultations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('appointment_id', sa.UUID(), nullable=True),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('doctor_id', sa.UUID(), nullable=False),
        sa.Column('branch_id', sa.UUID(), nullable=False),
        sa.Column('consultation_datetime', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('symptoms', sa.Text(), nullable=True),
        sa.Column('diagnosis', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('vitals_bp', sa.String(length=20), nullable=True),
        sa.Column('vitals_pulse', sa.Integer(), nullable=True),
        sa.Column('vitals_temperature', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_consultations_appointment_id'), 'consultations', ['appointment_id'], unique=False)
    op.create_index(op.f('ix_consultations_branch_id'), 'consultations', ['branch_id'], unique=False)
    op.create_index(op.f('ix_consultations_consultation_datetime'), 'consultations', ['consultation_datetime'], unique=False)
    op.create_index(op.f('ix_consultations_doctor_id'), 'consultations', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_consultations_patient_id'), 'consultations', ['patient_id'], unique=False)

    # 2. create prescriptions table
    op.create_table(
        'prescriptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('consultation_id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('doctor_id', sa.UUID(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['consultation_id'], ['consultations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_prescriptions_consultation_id'), 'prescriptions', ['consultation_id'], unique=False)
    op.create_index(op.f('ix_prescriptions_created_at'), 'prescriptions', ['created_at'], unique=False)
    op.create_index(op.f('ix_prescriptions_doctor_id'), 'prescriptions', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_prescriptions_patient_id'), 'prescriptions', ['patient_id'], unique=False)

    # 3. create prescription_items table
    op.create_table(
        'prescription_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('prescription_id', sa.UUID(), nullable=False),
        sa.Column('medicine_id', sa.UUID(), nullable=True),
        sa.Column('medicine_name', sa.String(length=200), nullable=False),
        sa.Column('dosage', sa.String(length=100), nullable=False),
        sa.Column('duration', sa.String(length=50), nullable=False),
        sa.Column('instructions', sa.String(length=250), nullable=True),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['prescription_id'], ['prescriptions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_prescription_items_medicine_id'), 'prescription_items', ['medicine_id'], unique=False)
    op.create_index(op.f('ix_prescription_items_prescription_id'), 'prescription_items', ['prescription_id'], unique=False)

    # 4. create treatment_plans table
    op.create_table(
        'treatment_plans',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('doctor_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('total_cost', sa.Float(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_treatment_plans_created_at'), 'treatment_plans', ['created_at'], unique=False)
    op.create_index(op.f('ix_treatment_plans_doctor_id'), 'treatment_plans', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_treatment_plans_patient_id'), 'treatment_plans', ['patient_id'], unique=False)
    op.create_index(op.f('ix_treatment_plans_status'), 'treatment_plans', ['status'], unique=False)

    # 5. create treatment_procedures table
    op.create_table(
        'treatment_procedures',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('treatment_plan_id', sa.UUID(), nullable=False),
        sa.Column('procedure_name', sa.String(length=200), nullable=False),
        sa.Column('cost', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['treatment_plan_id'], ['treatment_plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_treatment_procedures_treatment_plan_id'), 'treatment_procedures', ['treatment_plan_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_treatment_procedures_treatment_plan_id'), table_name='treatment_procedures')
    op.drop_table('treatment_procedures')
    op.drop_index(op.f('ix_treatment_plans_status'), table_name='treatment_plans')
    op.drop_index(op.f('ix_treatment_plans_patient_id'), table_name='treatment_plans')
    op.drop_index(op.f('ix_treatment_plans_doctor_id'), table_name='treatment_plans')
    op.drop_index(op.f('ix_treatment_plans_created_at'), table_name='treatment_plans')
    op.drop_table('treatment_plans')
    op.drop_index(op.f('ix_prescription_items_prescription_id'), table_name='prescription_items')
    op.drop_index(op.f('ix_prescription_items_medicine_id'), table_name='prescription_items')
    op.drop_table('prescription_items')
    op.drop_index(op.f('ix_prescriptions_patient_id'), table_name='prescriptions')
    op.drop_index(op.f('ix_prescriptions_doctor_id'), table_name='prescriptions')
    op.drop_index(op.f('ix_prescriptions_created_at'), table_name='prescriptions')
    op.drop_index(op.f('ix_prescriptions_consultation_id'), table_name='prescriptions')
    op.drop_table('prescriptions')
    op.drop_index(op.f('ix_consultations_patient_id'), table_name='consultations')
    op.drop_index(op.f('ix_consultations_doctor_id'), table_name='consultations')
    op.drop_index(op.f('ix_consultations_consultation_datetime'), table_name='consultations')
    op.drop_index(op.f('ix_consultations_branch_id'), table_name='consultations')
    op.drop_index(op.f('ix_consultations_appointment_id'), table_name='consultations')
    op.drop_table('consultations')
