from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func, case, select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel
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
from app.models.system_setting import SystemSetting
from app.models.attendance import Attendance
from app.models.availability_request import AvailabilityChangeRequest
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
    branch_id: Annotated[UUID | None, Query(description="Filter metrics by specific branch ID")] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Full admin dashboard: KPI cards, appointment status today,
    medicine stock health, branch list, staff list, patient visits trend,
    branch-filtered metrics, growth percentages, and live activity log.
    """
    _require_admin(current_user)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    yesterday_start = today_start - timedelta(days=1)

    # ── KPI: Total patients ────────────────────────────────────────────────
    patient_query = select(func.count(Patient.id))
    if branch_id:
        patient_query = patient_query.where(Patient.preferred_branch_id == branch_id)
    total_patients_res = await db.execute(patient_query)
    total_patients = total_patients_res.scalar_one()

    # ── KPI: Active doctors ───────────────────────────────────────────────
    doc_query = select(func.count(Doctor.id)).where(Doctor.is_available == True)
    if branch_id:
        doc_query = doc_query.where(Doctor.branch_id == branch_id)
    total_doctors_res = await db.execute(doc_query)
    total_doctors = total_doctors_res.scalar_one()

    # ── KPI: Appointments today & yesterday (for growth calc) ─────────────
    appts_today_query = select(func.count(Appointment.id)).where(
        Appointment.appointment_datetime >= today_start,
        Appointment.appointment_datetime < today_end,
    )
    if branch_id:
        appts_today_query = appts_today_query.where(Appointment.branch_id == branch_id)
    appts_today_res = await db.execute(appts_today_query)
    appts_today = appts_today_res.scalar_one()

    appts_yesterday_query = select(func.count(Appointment.id)).where(
        Appointment.appointment_datetime >= yesterday_start,
        Appointment.appointment_datetime < today_start,
    )
    if branch_id:
        appts_yesterday_query = appts_yesterday_query.where(Appointment.branch_id == branch_id)
    appts_yesterday_res = await db.execute(appts_yesterday_query)
    appts_yesterday = appts_yesterday_res.scalar_one()

    appts_growth_pct = 0.0
    if appts_yesterday > 0:
        appts_growth_pct = round(((appts_today - appts_yesterday) / appts_yesterday) * 100, 1)
    elif appts_today > 0:
        appts_growth_pct = 100.0

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

    # ── KPI: MTD Revenue & Last Month Revenue ────────────────────────────
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_end = month_start
    last_month_start = (month_start - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rev_query = select(func.coalesce(func.sum(Invoice.grand_total), 0))
    if branch_id:
        rev_query = rev_query.join(Consultation, Consultation.id == Invoice.consultation_id).where(Consultation.branch_id == branch_id)
    rev_query = rev_query.where(Invoice.created_at >= month_start)
    mtd_revenue_res = await db.execute(rev_query)
    mtd_revenue = float(mtd_revenue_res.scalar_one())

    last_rev_query = select(func.coalesce(func.sum(Invoice.grand_total), 0))
    if branch_id:
        last_rev_query = last_rev_query.join(Consultation, Consultation.id == Invoice.consultation_id).where(Consultation.branch_id == branch_id)
    last_rev_query = last_rev_query.where(Invoice.created_at >= last_month_start, Invoice.created_at < last_month_end)
    last_mtd_revenue_res = await db.execute(last_rev_query)
    last_mtd_revenue = float(last_mtd_revenue_res.scalar_one())

    revenue_growth_pct = 0.0
    if last_mtd_revenue > 0:
        revenue_growth_pct = round(((mtd_revenue - last_mtd_revenue) / last_mtd_revenue) * 100, 1)
    elif mtd_revenue > 0:
        revenue_growth_pct = 100.0

    # ── Appointment status breakdown (today) ────────────────────────────
    status_query = (
        select(Appointment.status, func.count(Appointment.id))
        .where(
            Appointment.appointment_datetime >= today_start,
            Appointment.appointment_datetime < today_end,
        )
    )
    if branch_id:
        status_query = status_query.where(Appointment.branch_id == branch_id)
    status_query = status_query.group_by(Appointment.status)
    
    appt_status_res = await db.execute(status_query)
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
        
        visit_q = select(func.count(Appointment.id)).where(
            Appointment.appointment_datetime >= mo_start,
            Appointment.appointment_datetime < mo_end,
            Appointment.status.in_(["completed", "checked_in"]),
        )
        if branch_id:
            visit_q = visit_q.where(Appointment.branch_id == branch_id)

        count_res = await db.execute(visit_q)
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
    staff_q = select(User).where(
        User.role.in_([UserRole.ADMIN, UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.RECEPTIONIST, UserRole.CLINIC_MANAGER])
    )
    if branch_id:
        staff_q = staff_q.where(User.branch_id == branch_id)
    staff_res = await db.execute(staff_q.order_by(User.full_name))
    staff_members = staff_res.scalars().all()
    staff_list = []
    for u in staff_members:
        is_suspended = u.suspended_until and u.suspended_until > now
        status_str = "suspended" if is_suspended else ("active" if u.is_active else "inactive")
        staff_list.append({
            "id": str(u.id),
            "name": u.full_name,
            "role": str(u.role),
            "email": u.email,
            "phone": u.phone or "—",
            "branch_id": str(u.branch_id) if u.branch_id else None,
            "status": status_str,
            "suspension_reason": u.suspension_reason,
            "suspended_until": u.suspended_until.isoformat() if u.suspended_until else None,
        })

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
    wf_q = select(Appointment).where(
        Appointment.appointment_datetime >= today_start,
        Appointment.appointment_datetime < today_end,
    )
    if branch_id:
        wf_q = wf_q.where(Appointment.branch_id == branch_id)
    
    workflow_res = await db.execute(wf_q.order_by(Appointment.appointment_datetime))
    today_appts = workflow_res.scalars().all()

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

    # ── Live Activity Audit Feed ──────────────────────────────────────────
    activity_q = select(Appointment).order_by(Appointment.created_at.desc()).limit(6)
    if branch_id:
        activity_q = activity_q.where(Appointment.branch_id == branch_id)
    recent_appts_res = await db.execute(activity_q)
    recent_appts = recent_appts_res.scalars().all()

    recent_activities = []
    for ra in recent_appts:
        patient_res = await db.execute(
            select(User).join(Patient, Patient.user_id == User.id).where(Patient.id == ra.patient_id)
        )
        p_user = patient_res.scalar_one_or_none()
        p_name = p_user.full_name if p_user else "Patient"
        recent_activities.append({
            "id": str(ra.id),
            "type": "appointment",
            "title": f"Appointment {ra.status.replace('_', ' ').title()}",
            "detail": f"{p_name} — {ra.treatment_type or 'Consultation'}",
            "time": ra.appointment_datetime.strftime("%d %b, %I:%M %p"),
            "status": ra.status
        })

    return ApiResponse.success(data={
            "kpis": {
                "total_revenue_mtd": mtd_revenue,
                "revenue_growth_pct": revenue_growth_pct,
                "total_patients": total_patients,
                "active_doctors": total_doctors,
                "appointments_today": appts_today,
                "appointments_growth_pct": appts_growth_pct,
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
            "recent_activities": recent_activities,
            "selected_branch_id": str(branch_id) if branch_id else None,
        }
    )


# ── GET /admin/reports ───────────────────────────────────────────────────────
@router.get("/reports")
async def get_admin_reports(
    report_type: Annotated[str, Query(description="Type of report: financial, clinical, or inventory")] = "financial",
    start_date: Annotated[str | None, Query(description="Start date (YYYY-MM-DD)")] = None,
    end_date: Annotated[str | None, Query(description="End date (YYYY-MM-DD)")] = None,
    branch_id: Annotated[UUID | None, Query(description="Filter by specific branch ID")] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Generate dynamic clinical, financial, or inventory reports with custom date ranges.
    Handles invalid/swapped dates, empty results, and branch filtering cleanly.
    """
    _require_admin(current_user)

    now = datetime.now(timezone.utc)
    # Parse dates safely with fallbacks
    dt_start = None
    dt_end = None

    if start_date and start_date.strip():
        try:
            dt_start = datetime.strptime(start_date, "%Y-%m-%d").replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        except Exception:
            dt_start = None

    if end_date and end_date.strip():
        try:
            dt_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except Exception:
            dt_end = None

    # Edge case: If both dates exist and start_date > end_date, swap them gracefully!
    if dt_start and dt_end and dt_start > dt_end:
        dt_start, dt_end = dt_end.replace(hour=0, minute=0, second=0), dt_start.replace(hour=23, minute=59, second=59)

    report_data: dict = {
        "report_type": report_type,
        "start_date": dt_start.strftime("%Y-%m-%d") if dt_start else "All Time",
        "end_date": dt_end.strftime("%Y-%m-%d") if dt_end else "All Time",
        "summary": {},
        "rows": []
    }

    if report_type == "financial":
        inv_q = select(Invoice)
        if dt_start:
            inv_q = inv_q.where(Invoice.created_at >= dt_start)
        if dt_end:
            inv_q = inv_q.where(Invoice.created_at <= dt_end)
        if branch_id:
            inv_q = inv_q.join(Consultation, Consultation.id == Invoice.consultation_id).where(Consultation.branch_id == branch_id)
        
        inv_res = await db.execute(inv_q.order_by(Invoice.created_at.desc()))
        invoices = inv_res.scalars().all()

        total_rev = sum(float(inv.grand_total) for inv in invoices)
        paid_count = sum(1 for inv in invoices if inv.status == "paid")

        report_data["summary"] = {
            "total_revenue": total_rev,
            "total_invoices": len(invoices),
            "paid_invoices": paid_count,
            "avg_invoice_value": round(total_rev / len(invoices), 2) if len(invoices) > 0 else 0.0,
        }
        report_rows = []
        for inv in invoices:
            p_name = "Patient Record"
            if getattr(inv, 'patient', None) and getattr(inv.patient, 'user', None):
                p_name = inv.patient.user.full_name
            
            pay_mode = "UPI / Cash"
            if getattr(inv, 'payments', None) and len(inv.payments) > 0:
                pay_mode = getattr(inv.payments[0], 'payment_method', 'UPI / Cash')

            b_name = "Central Branch"
            if getattr(inv, 'consultation', None) and getattr(inv.consultation, 'branch', None):
                b_name = inv.consultation.branch.name

            report_rows.append({
                "id": str(inv.id),
                "invoice_number": inv.invoice_number or f"INV-{str(inv.id)[:8]}",
                "date": inv.created_at.strftime("%Y-%m-%d %H:%M"),
                "patient_name": p_name,
                "amount": float(inv.grand_total),
                "payment_mode": pay_mode,
                "status": inv.status or "paid",
                "branch_name": b_name
            })
        report_data["rows"] = report_rows

    elif report_type == "clinical":
        appt_q = select(Appointment)
        if dt_start:
            appt_q = appt_q.where(Appointment.appointment_datetime >= dt_start)
        if dt_end:
            appt_q = appt_q.where(Appointment.appointment_datetime <= dt_end)
        if branch_id:
            appt_q = appt_q.where(Appointment.branch_id == branch_id)

        appts_res = await db.execute(appt_q.order_by(Appointment.appointment_datetime.desc()))
        appts = appts_res.scalars().all()

        completed = sum(1 for a in appts if a.status == "completed")
        cancelled = sum(1 for a in appts if a.status == "cancelled")
        teleconsult = sum(1 for a in appts if a.consultation_type == "teleconsultation")

        report_data["summary"] = {
            "total_appointments": len(appts),
            "completed": completed,
            "cancelled": cancelled,
            "teleconsultations": teleconsult,
            "completion_rate": round((completed / len(appts)) * 100, 1) if len(appts) > 0 else 0.0,
        }
        report_data["rows"] = [
            {
                "id": str(a.id),
                "date": a.appointment_datetime.strftime("%Y-%m-%d %I:%M %p"),
                "patient_id": str(a.patient_id),
                "treatment": a.treatment_type or "General Consultation",
                "type": a.consultation_type or "in_person",
                "status": a.status
            }
            for a in appts
        ]

    elif report_type == "doctor_revenue":
        doc_q = select(User).where(User.role == "doctor")
        if branch_id:
            doc_q = doc_q.where(User.branch_id == branch_id)
        doc_res = await db.execute(doc_q)
        doctors = doc_res.scalars().all()

        total_rev = 0.0
        rows = []
        for d in doctors:
            doc_profile_res = await db.execute(select(Doctor).where(Doctor.user_id == d.id))
            doc_prof = doc_profile_res.scalar_one_or_none()
            if not doc_prof:
                continue

            appts_q = select(Appointment).where(Appointment.doctor_id == doc_prof.id, Appointment.status == "completed")
            if dt_start:
                appts_q = appts_q.where(Appointment.appointment_datetime >= dt_start)
            if dt_end:
                appts_q = appts_q.where(Appointment.appointment_datetime <= dt_end)
            if branch_id:
                appts_q = appts_q.where(Appointment.branch_id == branch_id)
            appts_res = await db.execute(appts_q)
            completed_appts = appts_res.scalars().all()
            doc_rev = len(completed_appts) * float(doc_prof.consultation_fee or 500.0)
            total_rev += doc_rev

            rows.append({
                "id": str(d.id),
                "doctor_name": d.full_name,
                "specialization": doc_prof.specialization or "General Physician",
                "completed_consultations": len(completed_appts),
                "consultation_fee": float(doc_prof.consultation_fee or 500.0),
                "total_revenue": doc_rev,
                "status": "Active" if d.is_active else "Inactive"
            })

        report_data["summary"] = {
            "total_doctors": len(doctors),
            "total_revenue": round(total_rev, 2),
            "avg_revenue_per_doctor": round(total_rev / len(doctors), 2) if len(doctors) > 0 else 0.0,
        }
        report_data["rows"] = rows

    elif report_type == "staff_performance":
        staff_q = select(User).where(User.role.in_(["doctor", "receptionist", "pharmacist", "clinic_manager"]))
        if branch_id:
            staff_q = staff_q.where(User.branch_id == branch_id)
        staff_res = await db.execute(staff_q)
        staff_members = staff_res.scalars().all()
        rows = []
        for s in staff_members:
            br_name = "Global / Central"
            if s.branch_id:
                br_res = await db.execute(select(Branch).where(Branch.id == s.branch_id))
                br = br_res.scalar_one_or_none()
                if br:
                    br_name = br.name

            rows.append({
                "id": str(s.id),
                "staff_name": s.full_name,
                "role": s.role,
                "branch_name": br_name,
                "last_login": s.last_login_at.strftime("%Y-%m-%d %I:%M %p") if s.last_login_at else "Never",
                "status": "Active" if s.is_active else "Suspended"
            })

        report_data["summary"] = {
            "total_staff": len(staff_members),
            "active_staff": sum(1 for s in staff_members if s.is_active)
        }
        report_data["rows"] = rows

    elif report_type == "pharmacy_branch":
        br_q = select(Branch)
        if branch_id:
            br_q = br_q.where(Branch.id == branch_id)
        br_res = await db.execute(br_q)
        branches_list = br_res.scalars().all()

        med_res = await db.execute(select(Medicine).where(Medicine.is_active == True))
        medicines = med_res.scalars().all()
        total_valuation = sum(m.stock_qty * float(m.unit_price) for m in medicines)

        rows = []
        for br in branches_list:
            br_val = round(total_valuation / (len(branches_list) or 1), 2)
            rows.append({
                "id": str(br.id),
                "branch_name": br.name,
                "city": br.city,
                "skus_available": len(medicines),
                "stock_valuation": br_val,
                "status": "Active" if br.is_active else "Inactive"
            })

        report_data["summary"] = {
            "total_branches": len(branches_list),
            "total_valuation": round(sum(float(row["stock_valuation"]) for row in rows), 2)
        }
        report_data["rows"] = rows

    else:  # inventory report
        med_res = await db.execute(select(Medicine).where(Medicine.is_active == True).order_by(Medicine.name))
        medicines = med_res.scalars().all()

        total_valuation = sum(m.stock_qty * float(m.unit_price) for m in medicines)
        low_stock_count = sum(1 for m in medicines if m.stock_qty <= m.reorder_level)

        report_data["summary"] = {
            "total_skus": len(medicines),
            "low_stock_skus": low_stock_count,
            "total_valuation": round(total_valuation, 2),
        }
        report_data["rows"] = [
            {
                "id": str(m.id),
                "name": m.name,
                "category": m.category,
                "stock": m.stock_qty,
                "reorder_level": m.reorder_level,
                "unit_price": float(m.unit_price),
                "valuation": round(m.stock_qty * float(m.unit_price), 2),
                "status": "Low Stock" if m.stock_qty <= m.reorder_level else "In Stock"
            }
            for m in medicines
        ]

    return ApiResponse.success(data=report_data)


# ── GET & PUT /admin/settings ──────────────────────────────────────────────────

class SettingsUpdateRequest(BaseModel):
    gst_rate: float | None = None
    default_teleconsultation_fee: float | None = None
    currency_symbol: str | None = "₹"
    clinic_name: str | None = "Vertical Clinic"


@router.get("/settings", summary="Get system settings")
async def get_system_settings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Fetch system settings with fallback defaults."""
    _require_admin(current_user)

    settings_res = await db.execute(select(SystemSetting))
    settings_items = settings_res.scalars().all()

    settings_dict = {
        "gst_rate": 18.0,
        "default_teleconsultation_fee": 500.0,
        "currency_symbol": "₹",
        "clinic_name": "Vertical Clinic",
    }

    for item in settings_items:
        if item.key == "gst_rate":
            try:
                settings_dict["gst_rate"] = float(item.value)
            except ValueError:
                pass
        elif item.key == "default_teleconsultation_fee":
            try:
                settings_dict["default_teleconsultation_fee"] = float(item.value)
            except ValueError:
                pass
        else:
            settings_dict[item.key] = item.value

    return ApiResponse.success(data=settings_dict)


@router.put("/settings", summary="Update system settings")
async def update_system_settings(
    req: SettingsUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Update system settings in the database."""
    _require_admin(current_user)

    updates: dict[str, str] = {}
    if req.gst_rate is not None:
        updates["gst_rate"] = str(req.gst_rate)
    if req.default_teleconsultation_fee is not None:
        updates["default_teleconsultation_fee"] = str(req.default_teleconsultation_fee)
    if req.currency_symbol is not None:
        updates["currency_symbol"] = req.currency_symbol
    if req.clinic_name is not None:
        updates["clinic_name"] = req.clinic_name

    for key, val in updates.items():
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = res.scalar_one_or_none()
        if setting:
            setting.value = val
        else:
            setting = SystemSetting(key=key, value=val)
            db.add(setting)

    await db.commit()

    return ApiResponse.success(message="System settings updated successfully", data=updates)


# ── GET & POST /admin/sessions ───────────────────────────────────────────────

@router.get("/sessions", summary="Get active staff sessions & login history")
async def get_active_sessions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """List active staff login sessions with last active time and token status."""
    _require_admin(current_user)

    now = datetime.now(timezone.utc)
    twenty_four_hours_ago = now - timedelta(hours=24)

    users_res = await db.execute(
        select(User).where(
            User.role != UserRole.PATIENT,
            User.last_login_at.isnot(None),
            User.last_login_at >= twenty_four_hours_ago,
            User.is_active == True
        ).order_by(User.last_login_at.desc())
    )
    users = users_res.scalars().all()

    sessions = []
    for u in users:
        br_name = "Central / All Branches"
        if u.branch_id:
            b_res = await db.execute(select(Branch).where(Branch.id == u.branch_id))
            b = b_res.scalar_one_or_none()
            if b:
                br_name = b.name

        sessions.append({
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "branch_name": br_name,
            "last_login_at": u.last_login_at.strftime("%Y-%m-%d %I:%M %p") if u.last_login_at else "Never",
            "token_version": u.token_version,
            "is_active": u.is_active,
            "status": "Active Session"
        })

    return ApiResponse.success(data=sessions)


@router.post("/sessions/{user_id}/revoke", summary="Force logout / revoke session")
async def revoke_user_session(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Increment user token_version to force logout active JWT session."""
    _require_admin(current_user)

    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    user.token_version += 1
    user.last_login_at = None
    await db.commit()

    return ApiResponse.success(message=f"Session revoked and user {user.full_name} forced logout successfully!")


# ── GET /admin/attendance ───────────────────────────────────────────────────

@router.get("/attendance", summary="Get staff attendance logs")
async def get_staff_attendance(
    attendance_date: Annotated[str | None, Query(description="Date (YYYY-MM-DD)")] = None,
    branch_id: Annotated[UUID | None, Query(description="Branch ID filter")] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Fetch attendance list and summary stats for today or selected date."""
    _require_admin(current_user)

    from datetime import date as date_cls
    target_date = date_cls.today()
    if attendance_date and attendance_date.strip():
        try:
            target_date = datetime.strptime(attendance_date, "%Y-%m-%d").date()
        except Exception:
            pass

    # 1. Fetch all attendance records for target_date (optionally filtered by branch)
    att_q = select(Attendance).where(Attendance.date == target_date)
    if branch_id:
        att_q = att_q.where(Attendance.branch_id == branch_id)
    att_res = await db.execute(att_q)
    all_attendances = att_res.scalars().all()
    attendance_map = {att.user_id: att for att in all_attendances}

    # 2. Fetch all staff members that should be monitored
    staff_q = select(User).where(User.role.in_(["doctor", "receptionist", "pharmacist", "clinic_manager", "admin"]))
    if branch_id:
        staff_q = staff_q.where(User.branch_id == branch_id)
    all_staff_res = await db.execute(staff_q)
    all_staff = all_staff_res.scalars().all()

    # Union of staff members and anyone who actually punched in
    display_user_ids = set(u.id for u in all_staff).union(attendance_map.keys())
    if not display_user_ids:
        return ApiResponse.success(data={
            "summary": {
                "date": target_date.strftime("%Y-%m-%d"),
                "total_staff": 0,
                "present": 0,
                "late": 0,
                "on_leave": 0,
                "absent": 0
            },
            "records": []
        })

    # Fetch users to display
    display_users_res = await db.execute(
        select(User).where(User.id.in_(display_user_ids)).order_by(User.full_name)
    )
    display_users = display_users_res.scalars().all()

    # 3. Fetch approved leaves covering target_date
    from app.models.doctor import Doctor
    leave_q = select(
        AvailabilityChangeRequest.user_id,
        Doctor.user_id.label("doctor_user_id")
    ).outerjoin(
        Doctor, AvailabilityChangeRequest.doctor_id == Doctor.id
    ).where(
        AvailabilityChangeRequest.request_type == "leave",
        AvailabilityChangeRequest.status == "approved",
        AvailabilityChangeRequest.proposed_start_date <= target_date,
        AvailabilityChangeRequest.proposed_end_date >= target_date
    )
    leave_res = await db.execute(leave_q)
    leave_rows = leave_res.all()
    
    leave_user_ids = set()
    for row in leave_rows:
        if row.user_id:
            leave_user_ids.add(row.user_id)
        elif row.doctor_user_id:
            leave_user_ids.add(row.doctor_user_id)

    # 4. Fetch branch names for display mapping
    branch_res = await db.execute(select(Branch))
    branches = branch_res.scalars().all()
    branch_map = {b.id: b.name for b in branches}

    present_count = 0
    late_count = 0
    leave_count = 0
    absent_count = 0
    detail_rows = []

    for u in display_users:
        att = attendance_map.get(u.id)
        is_on_leave = u.id in leave_user_ids or (att is not None and att.status.lower() in ("on_leave", "leave"))
        
        u_branch_id = u.branch_id
        if att and att.branch_id:
            u_branch_id = att.branch_id
        branch_name = branch_map.get(u_branch_id, "Central Branch") if u_branch_id else "Central Branch"

        if is_on_leave:
            status = "LEAVE"
            punch_in = "- -"
            punch_out = "- -"
            leave_count += 1
        elif att is not None:
            status = att.status.upper()
            
            IST = timezone(timedelta(hours=5, minutes=30))
            p_in_ist = att.punch_in.astimezone(IST) if att.punch_in else None
            p_out_ist = att.punch_out.astimezone(IST) if att.punch_out else None
            
            punch_in = p_in_ist.strftime("%I:%M %p") if p_in_ist else "- -"
            punch_out = p_out_ist.strftime("%I:%M %p") if p_out_ist else "Active Shift"
            
            present_count += 1
            if att.status.lower() == "late":
                late_count += 1
        else:
            status = "ABSENT"
            punch_in = "- -"
            punch_out = "- -"
            absent_count += 1

        detail_rows.append({
            "id": str(att.id) if att else f"temp-{u.id}",
            "staff_name": u.full_name,
            "role": u.role,
            "branch_name": branch_name,
            "date": target_date.strftime("%Y-%m-%d"),
            "punch_in": punch_in,
            "punch_out": punch_out,
            "status": status,
            "notes": att.notes if att else "Not Punched In"
        })

    return ApiResponse.success(data={
        "summary": {
            "date": target_date.strftime("%Y-%m-%d"),
            "total_staff": len(display_users),
            "present": present_count,
            "late": late_count,
            "on_leave": leave_count,
            "absent": absent_count
        },
        "records": detail_rows
    })

