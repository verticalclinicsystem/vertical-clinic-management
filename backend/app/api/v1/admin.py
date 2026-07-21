"""
Admin dashboard API — all metrics sourced from the database.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import func, case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.appointment import Appointment
from app.models.teleconsult import TeleConsultation  # required for SQLAlchemy mapper resolution
from app.models.inventory import Medicine
from app.models.branch import Branch
from app.models.consultation import Consultation
from app.models.invoice import Invoice
from app.api.deps import get_current_active_user
from app.utils.response import ApiResponse

router = APIRouter()


def _require_admin(current_user: User) -> None:
    if current_user.role != UserRole.ADMIN:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")


# ── GET /admin/dashboard ─────────────────────────────────────────────────────
@router.get("/dashboard")
async def get_admin_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Full admin dashboard: KPI cards, appointment status today,
    medicine stock health, branch list, staff list, patient visits trend.
    """
    _require_admin(current_user)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # ── KPI: Total patients ────────────────────────────────────────────────
    total_patients_res = await db.execute(select(func.count(Patient.id)))
    total_patients = total_patients_res.scalar_one()

    # ── KPI: Active doctors ───────────────────────────────────────────────
    total_doctors_res = await db.execute(
        select(func.count(Doctor.id)).where(Doctor.is_available == True)
    )
    total_doctors = total_doctors_res.scalar_one()

    # ── KPI: Appointments today ───────────────────────────────────────────
    appts_today_res = await db.execute(
        select(func.count(Appointment.id)).where(
            Appointment.appointment_datetime >= today_start,
            Appointment.appointment_datetime < today_end,
        )
    )
    appts_today = appts_today_res.scalar_one()

    # ── KPI: Inventory SKUs + low-stock count ────────────────────────────
    total_skus_res = await db.execute(select(func.count(Medicine.id)).where(Medicine.is_active == True))
    total_skus = total_skus_res.scalar_one()

    low_stock_res = await db.execute(
        select(func.count(Medicine.id)).where(
            Medicine.is_active == True,
            Medicine.stock_qty <= Medicine.reorder_level,
        )
    )
    low_stock_count = low_stock_res.scalar_one()

    # ── KPI: Active branches ─────────────────────────────────────────────
    total_branches_res = await db.execute(
        select(func.count(Branch.id)).where(Branch.is_active == True)
    )
    total_branches = total_branches_res.scalar_one()

    # ── KPI: MTD Revenue ─────────────────────────────────────────────────
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    mtd_revenue_res = await db.execute(
        select(func.coalesce(func.sum(Invoice.grand_total), 0)).where(
            Invoice.created_at >= month_start
        )
    )
    mtd_revenue = float(mtd_revenue_res.scalar_one())

    # ── Appointment status breakdown (today) ────────────────────────────
    appt_status_res = await db.execute(
        select(Appointment.status, func.count(Appointment.id))
        .where(
            Appointment.appointment_datetime >= today_start,
            Appointment.appointment_datetime < today_end,
        )
        .group_by(Appointment.status)
    )
    appt_status_raw = appt_status_res.all()
    appt_status = {row[0]: row[1] for row in appt_status_raw}

    # ── Medicine stock health ─────────────────────────────────────────────
    in_stock_res = await db.execute(
        select(func.count(Medicine.id)).where(
            Medicine.is_active == True,
            Medicine.stock_qty > Medicine.reorder_level,
        )
    )
    in_stock = in_stock_res.scalar_one()

    # ── Patient visits last 6 months (one data point per month) ──────────
    visits_by_month = []
    for i in range(5, -1, -1):
        mo_start = (now.replace(day=1) - timedelta(days=i * 28)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        if i == 0:
            mo_end = now
        else:
            next_mo = (mo_start + timedelta(days=32)).replace(day=1)
            mo_end = next_mo
        count_res = await db.execute(
            select(func.count(Appointment.id)).where(
                Appointment.appointment_datetime >= mo_start,
                Appointment.appointment_datetime < mo_end,
                Appointment.status.in_(["completed", "checked_in"]),
            )
        )
        visits_by_month.append({
            "month": mo_start.strftime("%b"),
            "count": count_res.scalar_one(),
        })

    # ── Branch list ──────────────────────────────────────────────────────
    branches_res = await db.execute(
        select(Branch).order_by(Branch.name)
    )
    branches = branches_res.scalars().all()
    branch_list = []
    for br in branches:
        doc_count_res = await db.execute(
            select(func.count(Doctor.id)).where(Doctor.branch_id == br.id)
        )
        staff_count_res = await db.execute(
            select(func.count(User.id)).where(User.branch_id == br.id)
        )
        branch_revenue_res = await db.execute(
            select(func.coalesce(func.sum(Invoice.grand_total), 0))
            .join(Consultation, Consultation.id == Invoice.consultation_id)
            .where(
                Consultation.branch_id == br.id,
                Invoice.created_at >= month_start
            )
        )
        branch_revenue = float(branch_revenue_res.scalar_one())
        branch_list.append({
            "id": str(br.id),
            "code": br.code,
            "name": br.name,
            "city": br.city,
            "phone": br.phone,
            "email": br.email,
            "address": br.address or "",
            "gst_number": br.gst_number or "",
            "doctors": doc_count_res.scalar_one(),
            "status": "active" if br.is_active else "inactive",
            "staff": staff_count_res.scalar_one(),
            "revenue": branch_revenue,
        })

    # ── Staff list ───────────────────────────────────────────────────────
    staff_res = await db.execute(
        select(User).where(
            User.role.in_([UserRole.ADMIN, UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.RECEPTIONIST])
        ).order_by(User.full_name)
    )
    staff_members = staff_res.scalars().all()
    staff_list = [
        {
            "id": str(u.id),
            "name": u.full_name,
            "role": str(u.role),
            "email": u.email,
            "phone": u.phone or "—",
            "branch_id": str(u.branch_id) if u.branch_id else None,
            "status": "active" if u.is_active else "inactive",
        }
        for u in staff_members
    ]

    # ── Inventory list ────────────────────────────────────────────────────
    inv_res = await db.execute(
        select(Medicine).where(Medicine.is_active == True).order_by(Medicine.name)
    )
    medicines = inv_res.scalars().all()
    inventory_list = [
        {
            "id": str(m.id),
            "name": m.name,
            "category": m.category,
            "stock": m.stock_qty,
            "reorder_level": m.reorder_level,
            "unit": m.unit,
            "unit_price": m.unit_price,
            "supplier": m.supplier,
            "is_low_stock": m.stock_qty <= m.reorder_level,
            "status": "Low Stock" if m.stock_qty <= m.reorder_level else "In Stock",
        }
        for m in medicines
    ]

    # ── Workflow: today's appointments as kanban cards ───────────────────
    workflow_res = await db.execute(
        select(Appointment).where(
            Appointment.appointment_datetime >= today_start,
            Appointment.appointment_datetime < today_end,
        ).order_by(Appointment.appointment_datetime)
    )
    today_appts = workflow_res.scalars().all()

    # Eager-load patient & doctor names for workflow
    workflow_cards: dict = {"reception": [], "consultation": [], "billing": [], "dispensary": []}
    for appt in today_appts:
        patient_res = await db.execute(
            select(User).join(Patient, Patient.user_id == User.id).where(Patient.id == appt.patient_id)
        )
        patient_user = patient_res.scalar_one_or_none()
        patient_name = patient_user.full_name if patient_user else "Unknown Patient"

        card = {
            "id": str(appt.id),
            "title": patient_name,
            "desc": f"{appt.treatment_type or 'Consultation'} — {appt.consultation_type or 'in_person'}",
            "time": appt.appointment_datetime.strftime("%I:%M %p"),
            "status": appt.status,
        }

        if appt.status in ("pending", "confirmed"):
            workflow_cards["reception"].append(card)
        elif appt.status == "checked_in":
            workflow_cards["consultation"].append(card)
        elif appt.status == "completed":
            workflow_cards["billing"].append(card)
        else:
            workflow_cards["dispensary"].append(card)

    return ApiResponse.success(data={
            "kpis": {
                "total_revenue_mtd": mtd_revenue,
                "total_patients": total_patients,
                "active_doctors": total_doctors,
                "appointments_today": appts_today,
                "total_skus": total_skus,
                "low_stock_count": low_stock_count,
                "active_branches": total_branches,
            },
            "appointment_status_today": {
                "confirmed": appt_status.get("confirmed", 0),
                "checked_in": appt_status.get("checked_in", 0),
                "completed": appt_status.get("completed", 0),
                "cancelled": appt_status.get("cancelled", 0),
                "pending": appt_status.get("pending", 0),
                "total": appts_today,
            },
            "medicine_stock_health": {
                "total": total_skus,
                "in_stock": in_stock,
                "low_stock": low_stock_count,
            },
            "patient_visits_trend": visits_by_month,
            "branches": branch_list,
            "staff": staff_list,
            "inventory": inventory_list,
            "workflow": workflow_cards,
        }
    )
