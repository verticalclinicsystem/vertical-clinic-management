"""
IPD (In-Patient Department) Router — manages admissions, bed allocations, vitals logs, medication administrations, and dynamic billing checkouts.
"""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.core.exceptions import PermissionDeniedError
from app.models.doctor import Doctor
from app.models.notification import Notification
from app.models.ipd import (
    Admission,
    Bed,
    BedCategory,
    BedTransferLog,
    IpdBillItem,
    IpdClinicalRecord,
    IpdMedicationAdministration,
    IpdAdmissionRequest,
)
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.utils.response import ApiResponse

router = APIRouter()


# ── Pydantic Request Schemas ──────────────────────────────────────────────────
class AdmissionRequestCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    reason: str
    urgency: str = "routine"  # "routine" | "urgent" | "emergency"

class BedCategoryCreateUpdate(BaseModel):
    name: str
    base_charge_24h: float
    hourly_overtime_rate: float
    tax_rate: float

class BedCreate(BaseModel):
    bed_number: str
    category_id: uuid.UUID
    branch_id: uuid.UUID

class AdmissionCreate(BaseModel):
    patient_id: uuid.UUID
    bed_id: uuid.UUID
    admitting_doctor_id: uuid.UUID
    diagnosis: str
    initial_deposit: float = 0.0
    insurance_approved_amount: float = 0.0

class BedTransferRequest(BaseModel):
    to_bed_id: uuid.UUID
    reason: str

class VitalsRecordCreate(BaseModel):
    temp: float
    pulse: int
    systolic_bp: int
    diastolic_bp: int
    spo2: int
    respiratory_rate: int
    nursing_notes: str

class MedicationScheduleCreate(BaseModel):
    medicine_name: str
    dosage: str
    scheduled_time: datetime

class MedicationAdministerRequest(BaseModel):
    status: str  # "administered" | "missed"


# ── 1. GET /ipd/dashboard/beds ────────────────────────────────────────────────
@router.get("/dashboard/beds", response_class=JSONResponse)
async def get_beds_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Get real-time bed occupancy and details."""
    # Build query to fetch all beds
    stmt = select(Bed)
    res = await db.execute(stmt)
    beds = res.scalars().all()

    # Build active admissions dict
    adm_stmt = select(Admission).where(Admission.admission_status != "discharged")
    adm_res = await db.execute(adm_stmt)
    active_admissions = adm_res.scalars().all()
    adm_map = {adm.bed_id: adm for adm in active_admissions}

    beds_data = []
    for bed in beds:
        active_adm = adm_map.get(bed.id)
        patient_info = None
        if active_adm:
            patient_info = {
                "admission_id": str(active_adm.id),
                "patient_id": str(active_adm.patient_id),
                "patient_name": active_adm.patient.name or active_adm.patient.user.full_name,
                "patient_code": active_adm.patient.patient_code,
                "admitting_doctor": active_adm.doctor.name or active_adm.doctor.user.full_name,
                "admission_datetime": active_adm.admission_datetime.isoformat(),
                "diagnosis": active_adm.diagnosis,
                "initial_deposit": active_adm.initial_deposit,
                "insurance_approved_amount": active_adm.insurance_approved_amount
            }

        beds_data.append({
            "id": str(bed.id),
            "bed_number": bed.bed_number,
            "status": bed.status,
            "category": {
                "id": str(bed.category.id),
                "name": bed.category.name,
                "base_charge_24h": bed.category.base_charge_24h,
                "hourly_overtime_rate": bed.category.hourly_overtime_rate,
                "tax_rate": bed.category.tax_rate
            },
            "branch_id": str(bed.branch_id),
            "branch_name": bed.branch.name,
            "active_admission": patient_info
        })

    return ApiResponse.success(data=beds_data, message="Beds dashboard retrieved successfully.")


@router.get("/admissions/history", response_class=JSONResponse)
async def get_admissions_history(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Get complete bed booking / IPD admission history logs."""
    stmt = (
        select(Admission)
        .order_by(Admission.admission_datetime.desc())
    )
    res = await db.execute(stmt)
    admissions = res.scalars().all()

    history_data = []
    for adm in admissions:
        discharge_time = adm.discharge_datetime.isoformat() if adm.discharge_datetime else None
        
        # Calculate stay duration
        end_dt = adm.discharge_datetime or datetime.now(UTC)
        total_seconds = max(0, (end_dt - adm.admission_datetime).total_seconds())
        total_hours = round(total_seconds / 3600.0, 1)
        total_days = round(total_hours / 24.0, 1)

        p_phone = "N/A"
        em_phone = "N/A"
        if adm.patient:
            p_name = adm.patient.name or (adm.patient.user.full_name if adm.patient.user else "N/A")
            if adm.patient.user and adm.patient.user.phone:
                p_phone = adm.patient.user.phone
            em_phone = adm.patient.emergency_contact_phone or "N/A"

        d_name = "N/A"
        d_phone = "N/A"
        if adm.doctor:
            d_name = adm.doctor.name or (adm.doctor.user.full_name if adm.doctor.user else "N/A")
            if adm.doctor.user and adm.doctor.user.phone:
                d_phone = adm.doctor.user.phone

        history_data.append({
            "id": str(adm.id),
            "patient_id": str(adm.patient_id),
            "patient_name": p_name,
            "patient_code": adm.patient.patient_code if adm.patient else "N/A",
            "patient_phone": p_phone,
            "emergency_contact_phone": em_phone,
            "bed_id": str(adm.bed_id),
            "bed_number": adm.bed.bed_number if adm.bed else "N/A",
            "category_name": adm.bed.category.name if (adm.bed and adm.bed.category) else "General Ward",
            "base_charge_24h": adm.bed.category.base_charge_24h if (adm.bed and adm.bed.category) else 0,
            "hourly_overtime_rate": adm.bed.category.hourly_overtime_rate if (adm.bed and adm.bed.category) else 0,
            "admitting_doctor": d_name,
            "doctor_phone": d_phone,
            "admission_datetime": adm.admission_datetime.isoformat(),
            "discharge_datetime": discharge_time,
            "admission_status": adm.admission_status,
            "diagnosis": adm.diagnosis,
            "initial_deposit": adm.initial_deposit,
            "insurance_approved_amount": adm.insurance_approved_amount,
            "stay_hours": total_hours,
            "stay_days": total_days
        })

    return ApiResponse.success(data=history_data, message="Admission history retrieved successfully.")


# ── GET /ipd/admissions/{id}/summary ──────────────────────────────────────────
@router.get("/admissions/{id}/summary", response_class=JSONResponse)
async def get_admission_full_summary(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Get full details of a specific past or current admission including vitals, MAC, and transfers."""
    stmt = select(Admission).where(Admission.id == id)
    res = await db.execute(stmt)
    adm = res.scalar_one_or_none()
    if not adm:
        raise NotFoundError("Admission record not found.")

    # Calculate stay duration
    end_dt = adm.discharge_datetime or datetime.now(UTC)
    total_seconds = max(0, (end_dt - adm.admission_datetime).total_seconds())
    total_hours = round(total_seconds / 3600.0, 1)
    total_days = round(total_hours / 24.0, 1)

    p_name = "N/A"
    p_phone = "N/A"
    em_phone = "N/A"
    if adm.patient:
        p_name = adm.patient.name or (adm.patient.user.full_name if adm.patient.user else "N/A")
        if adm.patient.user and adm.patient.user.phone:
            p_phone = adm.patient.user.phone
        em_phone = adm.patient.emergency_contact_phone or "N/A"

    d_name = "N/A"
    d_phone = "N/A"
    if adm.doctor:
        d_name = adm.doctor.name or (adm.doctor.user.full_name if adm.doctor.user else "N/A")
        if adm.doctor.user and adm.doctor.user.phone:
            d_phone = adm.doctor.user.phone

    # Vitals history
    vitals_stmt = select(IpdClinicalRecord).where(IpdClinicalRecord.admission_id == id).order_by(IpdClinicalRecord.recorded_at.desc())
    vitals_res = await db.execute(vitals_stmt)
    vitals_list = vitals_res.scalars().all()
    vitals_data = [{
        "id": str(r.id),
        "recorded_at": r.recorded_at.isoformat(),
        "recorded_by": r.recorder.full_name if r.recorder else "N/A",
        "temp": r.temp,
        "pulse": r.pulse,
        "bp": f"{r.systolic_bp}/{r.diastolic_bp}",
        "spo2": r.spo2,
        "respiratory_rate": r.respiratory_rate,
        "nursing_notes": r.nursing_notes
    } for r in vitals_list]

    # MAC logs
    mac_stmt = select(IpdMedicationAdministration).where(IpdMedicationAdministration.admission_id == id).order_by(IpdMedicationAdministration.scheduled_time.asc())
    mac_res = await db.execute(mac_stmt)
    mac_list = mac_res.scalars().all()
    mac_data = [{
        "id": str(r.id),
        "medicine_name": r.medicine_name,
        "dosage": r.dosage,
        "scheduled_time": r.scheduled_time.isoformat(),
        "administered_time": r.administered_time.isoformat() if r.administered_time else None,
        "status": r.status
    } for r in mac_list]

    # Transfer logs
    transfer_stmt = select(BedTransferLog).where(BedTransferLog.admission_id == id).order_by(BedTransferLog.transferred_at.desc())
    transfer_res = await db.execute(transfer_stmt)
    transfer_list = transfer_res.scalars().all()
    transfer_data = [{
        "id": str(t.id),
        "from_bed": t.from_bed.bed_number if t.from_bed else "N/A",
        "to_bed": t.to_bed.bed_number if t.to_bed else "N/A",
        "transferred_at": t.transferred_at.isoformat(),
        "reason": t.reason
    } for t in transfer_list]

    full_summary = {
        "id": str(adm.id),
        "patient_id": str(adm.patient_id),
        "patient_name": p_name,
        "patient_code": adm.patient.patient_code if adm.patient else "N/A",
        "patient_phone": p_phone,
        "emergency_contact_phone": em_phone,
        "bed_id": str(adm.bed_id),
        "bed_number": adm.bed.bed_number if adm.bed else "N/A",
        "category_name": adm.bed.category.name if (adm.bed and adm.bed.category) else "General Ward",
        "base_charge_24h": adm.bed.category.base_charge_24h if (adm.bed and adm.bed.category) else 0,
        "hourly_overtime_rate": adm.bed.category.hourly_overtime_rate if (adm.bed and adm.bed.category) else 0,
        "admitting_doctor": d_name,
        "doctor_phone": d_phone,
        "admission_datetime": adm.admission_datetime.isoformat(),
        "discharge_datetime": adm.discharge_datetime.isoformat() if adm.discharge_datetime else None,
        "admission_status": adm.admission_status,
        "diagnosis": adm.diagnosis,
        "initial_deposit": adm.initial_deposit,
        "insurance_approved_amount": adm.insurance_approved_amount,
        "stay_hours": total_hours,
        "stay_days": total_days,
        "vitals_records": vitals_data,
        "mac_records": mac_data,
        "transfer_logs": transfer_data
    }

    return ApiResponse.success(data=full_summary, message="Admission full summary retrieved successfully.")


# ── 2. GET /ipd/categories ────────────────────────────────────────────────────
@router.get("/categories", response_class=JSONResponse)
async def get_bed_categories(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    res = await db.execute(select(BedCategory))
    categories = res.scalars().all()
    data = [{
        "id": str(cat.id),
        "name": cat.name,
        "base_charge_24h": cat.base_charge_24h,
        "hourly_overtime_rate": cat.hourly_overtime_rate,
        "tax_rate": cat.tax_rate
    } for cat in categories]
    return ApiResponse.success(data=data, message="Bed categories retrieved successfully.")


# ── 3. POST /ipd/categories ───────────────────────────────────────────────────
@router.post("/categories", response_class=JSONResponse)
async def create_or_update_category(
    request: BedCategoryCreateUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Configure bed category pricing (restricted to Admin)."""
    if current_user.role != UserRole.ADMIN:
        raise PermissionDeniedError("Only system administrators can modify bed categories.")

    stmt = select(BedCategory).where(BedCategory.name == request.name)
    res = await db.execute(stmt)
    cat = res.scalar_one_or_none()

    if cat:
        cat.base_charge_24h = request.base_charge_24h
        cat.hourly_overtime_rate = request.hourly_overtime_rate
        cat.tax_rate = request.tax_rate
        message = "Bed category updated successfully."
    else:
        cat = BedCategory(
            id=uuid.uuid4(),
            name=request.name,
            base_charge_24h=request.base_charge_24h,
            hourly_overtime_rate=request.hourly_overtime_rate,
            tax_rate=request.tax_rate
        )
        db.add(cat)
        message = "Bed category created successfully."

    await db.flush()
    return ApiResponse.success(
        data={
            "id": str(cat.id),
            "name": cat.name,
            "base_charge_24h": cat.base_charge_24h,
            "hourly_overtime_rate": cat.hourly_overtime_rate,
            "tax_rate": cat.tax_rate
        },
        message=message
    )


# ── 3a. POST /ipd/beds ────────────────────────────────────────────────────────
@router.post("/beds", response_class=JSONResponse)
async def create_bed(
    request: BedCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Register a physical bed (restricted to Admin)."""
    if current_user.role != UserRole.ADMIN:
        raise PermissionDeniedError("Only system administrators can register beds.")
    
    # Check if bed already exists in this branch
    existing_stmt = select(Bed).where(Bed.branch_id == request.branch_id, Bed.bed_number == request.bed_number)
    res = await db.execute(existing_stmt)
    if res.scalar_one_or_none():
        return ApiResponse.error(message=f"Bed '{request.bed_number}' already exists in this branch.", code=400)
    
    # Create bed
    bed = Bed(
        id=uuid.uuid4(),
        bed_number=request.bed_number,
        category_id=request.category_id,
        branch_id=request.branch_id,
        status="available"
    )
    db.add(bed)
    await db.flush()
    return ApiResponse.success(
        data={
            "id": str(bed.id),
            "bed_number": bed.bed_number,
            "status": bed.status,
            "category_id": str(bed.category_id),
            "branch_id": str(bed.branch_id)
        },
        message="Physical bed registered successfully."
    )


# ── 3b. DELETE /ipd/beds/{id} ─────────────────────────────────────────────────
@router.delete("/beds/{id}", response_class=JSONResponse)
async def delete_bed(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Decommission a bed (restricted to Admin). Only available beds can be decommissioned."""
    if current_user.role != UserRole.ADMIN:
        raise PermissionDeniedError("Only system administrators can decommission beds.")
    
    stmt = select(Bed).where(Bed.id == id)
    res = await db.execute(stmt)
    bed = res.scalar_one_or_none()
    if not bed:
        return ApiResponse.error(message="Bed asset not found.", code=404)
    
    if bed.status != "available":
        return ApiResponse.error(message=f"Cannot decommission bed in '{bed.status}' state.", code=400)
    
    await db.delete(bed)
    await db.flush()
    return ApiResponse.success(message="Bed asset decommissioned successfully.")


# ── 4. POST /ipd/admissions ───────────────────────────────────────────────────
@router.post("/admissions", response_class=JSONResponse, status_code=201)
async def admit_patient(
    request: AdmissionCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Admit a patient to a bed."""
    if current_user.role not in [UserRole.ADMIN, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST]:
        raise PermissionDeniedError("Only staff members can perform admissions.")

    # Check bed status
    bed_res = await db.execute(select(Bed).where(Bed.id == request.bed_id))
    bed = bed_res.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found.")
    if bed.status != "available":
        raise HTTPException(status_code=400, detail=f"Bed is currently {bed.status} and cannot be assigned.")

    # Check patient
    pat_res = await db.execute(select(Patient).where(Patient.id == request.patient_id))
    if not pat_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found.")

    # Check doctor
    doc_res = await db.execute(select(Doctor).where(Doctor.id == request.admitting_doctor_id))
    if not doc_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Admitting doctor not found.")

    # Create Admission Record
    admission = Admission(
        id=uuid.uuid4(),
        patient_id=request.patient_id,
        bed_id=request.bed_id,
        admitting_doctor_id=request.admitting_doctor_id,
        admission_status="admitted",
        admission_datetime=datetime.now(UTC),
        diagnosis=request.diagnosis,
        initial_deposit=request.initial_deposit,
        insurance_approved_amount=request.insurance_approved_amount
    )
    db.add(admission)

    # Lock Bed
    bed.status = "occupied"

    await db.flush()
    return ApiResponse.success(
        data={"admission_id": str(admission.id)},
        message="Patient admitted successfully.",
        status_code=201
    )


# ── 5. POST /ipd/admissions/{id}/transfer ─────────────────────────────────────
@router.post("/admissions/{id}/transfer", response_class=JSONResponse)
async def transfer_patient(
    id: uuid.UUID,
    request: BedTransferRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Transfer patient to a different bed category/number."""
    if current_user.role not in [UserRole.ADMIN, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST]:
        raise PermissionDeniedError("Only staff members can perform bed transfers.")

    adm_res = await db.execute(select(Admission).where(Admission.id == id, Admission.admission_status == "admitted"))
    admission = adm_res.scalar_one_or_none()
    if not admission:
        raise HTTPException(status_code=404, detail="Active admission record not found.")

    # Check new bed
    new_bed_res = await db.execute(select(Bed).where(Bed.id == request.to_bed_id))
    new_bed = new_bed_res.scalar_one_or_none()
    if not new_bed:
        raise HTTPException(status_code=404, detail="Target bed not found.")
    if new_bed.status != "available":
        raise HTTPException(status_code=400, detail="Target bed is occupied or not ready.")

    old_bed_id = admission.bed_id

    # Create transfer log
    log = BedTransferLog(
        id=uuid.uuid4(),
        admission_id=admission.id,
        from_bed_id=old_bed_id,
        to_bed_id=new_bed.id,
        transferred_at=datetime.now(UTC),
        transferred_by=current_user.id,
        reason=request.reason
    )
    db.add(log)

    # Free old bed asset & set to cleaning state
    old_bed_res = await db.execute(select(Bed).where(Bed.id == old_bed_id))
    old_bed = old_bed_res.scalar_one_or_none()
    if old_bed:
        old_bed.status = "cleaning"
        old_bed.last_cleaned_at = None

    # Update admission bed reference
    admission.bed_id = new_bed.id

    # Set new bed status to occupied
    new_bed.status = "occupied"

    # Capture billing snapshot of old bed to add to bill items
    time_spent = datetime.now(UTC) - admission.admission_datetime
    hours = max(1.0, time_spent.total_seconds() / 3600.0)
    days = hours / 24.0
    
    # Simple pro-rata cost calculation for display
    cost = days * old_bed.category.base_charge_24h
    bill_item = IpdBillItem(
        id=uuid.uuid4(),
        admission_id=admission.id,
        item_name=f"Bed Rent: {old_bed.bed_number} ({old_bed.category.name})",
        quantity=round(days, 2),
        unit_price=old_bed.category.base_charge_24h,
        total_price=round(cost, 2)
    )
    db.add(bill_item)

    await db.flush()
    return ApiResponse.success(message="Patient transferred successfully.")


# ── 6. POST /ipd/admissions/{id}/vitals ───────────────────────────────────────
@router.post("/admissions/{id}/vitals", response_class=JSONResponse, status_code=201)
async def record_vitals(
    id: uuid.UUID,
    request: VitalsRecordCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Record clinical rounding vitals (doctor/nurse role)."""
    if current_user.role not in [UserRole.ADMIN, UserRole.CLINIC_MANAGER, UserRole.DOCTOR, UserRole.RECEPTIONIST]:
        raise PermissionDeniedError("Only authorized clinical staff can log vitals.")

    record = IpdClinicalRecord(
        id=uuid.uuid4(),
        admission_id=id,
        recorded_at=datetime.now(UTC),
        recorded_by=current_user.id,
        temp=request.temp,
        pulse=request.pulse,
        systolic_bp=request.systolic_bp,
        diastolic_bp=request.diastolic_bp,
        spo2=request.spo2,
        respiratory_rate=request.respiratory_rate,
        nursing_notes=request.nursing_notes
    )
    db.add(record)
    await db.flush()
    return ApiResponse.success(message="Rounding vitals logged successfully.", status_code=201)


# ── 7. GET /ipd/admissions/{id}/vitals ────────────────────────────────────────
@router.get("/admissions/{id}/vitals", response_class=JSONResponse)
async def get_vitals_history(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    stmt = select(IpdClinicalRecord).where(IpdClinicalRecord.admission_id == id).order_by(IpdClinicalRecord.recorded_at.desc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    data = [{
        "id": str(r.id),
        "recorded_at": r.recorded_at.isoformat(),
        "recorded_by": r.recorder.full_name,
        "temp": r.temp,
        "pulse": r.pulse,
        "bp": f"{r.systolic_bp}/{r.diastolic_bp}",
        "spo2": r.spo2,
        "respiratory_rate": r.respiratory_rate,
        "nursing_notes": r.nursing_notes
    } for r in records]

    return ApiResponse.success(data=data, message="Vitals history retrieved.")


# ── 8. POST /ipd/admissions/{id}/mac ──────────────────────────────────────────
@router.post("/admissions/{id}/mac", response_class=JSONResponse, status_code=201)
async def schedule_medication(
    id: uuid.UUID,
    request: MedicationScheduleCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Schedule medicine in MAC (doctor/receptionist role)."""
    if current_user.role not in [UserRole.ADMIN, UserRole.CLINIC_MANAGER, UserRole.DOCTOR, UserRole.RECEPTIONIST]:
        raise PermissionDeniedError("Only clinical staff can schedule medications.")

    med = IpdMedicationAdministration(
        id=uuid.uuid4(),
        admission_id=id,
        medicine_name=request.medicine_name,
        dosage=request.dosage,
        scheduled_time=request.scheduled_time,
        status="scheduled"
    )
    db.add(med)
    await db.flush()
    return ApiResponse.success(message="Medication scheduled successfully.", status_code=201)


# ── 9. GET /ipd/admissions/{id}/mac ───────────────────────────────────────────
@router.get("/admissions/{id}/mac", response_class=JSONResponse)
async def get_medication_records(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    stmt = select(IpdMedicationAdministration).where(IpdMedicationAdministration.admission_id == id).order_by(IpdMedicationAdministration.scheduled_time.asc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    data = [{
        "id": str(r.id),
        "medicine_name": r.medicine_name,
        "dosage": r.dosage,
        "scheduled_time": r.scheduled_time.isoformat(),
        "administered_time": r.administered_time.isoformat() if r.administered_time else None,
        "status": r.status,
    } for r in records]

    return ApiResponse.success(data=data, message="Medication log retrieved.")


# ── 10. PATCH /ipd/admissions/mac/{item_id} ───────────────────────────────────
@router.patch("/admissions/mac/{item_id}", response_class=JSONResponse)
async def administer_medication(
    item_id: uuid.UUID,
    request: MedicationAdministerRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Mark scheduled medication status as administered/missed."""
    stmt = select(IpdMedicationAdministration).where(IpdMedicationAdministration.id == item_id)
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Medication record not found.")

    record.status = request.status
    if request.status == "administered":
        record.administered_time = datetime.now(UTC)
        record.administered_by = current_user.id
    else:
        record.administered_time = None
        record.administered_by = None

    await db.flush()
    return ApiResponse.success(message=f"Medication marked as {request.status}.")


# ── 11. GET /ipd/admissions/{id}/bill-summary ─────────────────────────────────
@router.get("/admissions/{id}/bill-summary", response_class=JSONResponse)
async def get_bill_summary(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Calculate the pro-rated invoice for the active stay."""
    adm_res = await db.execute(select(Admission).where(Admission.id == id))
    admission = adm_res.scalar_one_or_none()
    if not admission:
        raise HTTPException(status_code=404, detail="Admission record not found.")

    # Calculate active bed stay charges
    end_time = admission.discharge_datetime or datetime.now(UTC)
    delta = end_time - admission.admission_datetime
    hours_stay = max(0.5, delta.total_seconds() / 3600.0)

    bed = admission.bed
    base_charge_24h = bed.category.base_charge_24h
    hourly_rate = bed.category.hourly_overtime_rate

    # Standard billing calculation logic (Grace period of 2 hours)
    # Minimum stay charge of 1 day is applied for any admission
    days = int(hours_stay // 24)
    rem_hours = hours_stay % 24
    if days == 0:
        current_bed_rent = base_charge_24h
    else:
        overtime_cost = rem_hours * hourly_rate if rem_hours > 2.0 else 0.0
        current_bed_rent = (days * base_charge_24h) + overtime_cost
    current_bed_rent = round(current_bed_rent, 2)

    # Fetch previously frozen bill items (like past beds from transfers)
    items_res = await db.execute(select(IpdBillItem).where(IpdBillItem.admission_id == id))
    past_items = items_res.scalars().all()

    bill_lines = []
    subtotal = 0.0

    # Add active bed line
    bill_lines.append({
        "item_name": f"Current Bed Rent: {bed.bed_number} ({bed.category.name})",
        "quantity": round(hours_stay / 24.0, 2),
        "unit_price": base_charge_24h,
        "total_price": current_bed_rent
    })
    subtotal += current_bed_rent

    for item in past_items:
        bill_lines.append({
            "item_name": item.item_name,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": item.total_price
        })
        subtotal += item.total_price

    # Admin configured tax rate
    tax_amount = round(subtotal * bed.category.tax_rate, 2)
    grand_total = round(subtotal + tax_amount, 2)

    balance_due = round(grand_total - admission.initial_deposit - admission.insurance_approved_amount, 2)

    data = {
        "admission_id": str(admission.id),
        "patient_name": admission.patient.name or admission.patient.user.full_name,
        "admission_date": admission.admission_datetime.isoformat(),
        "hours_stayed": round(hours_stay, 1),
        "bill_items": bill_lines,
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "grand_total": grand_total,
        "initial_deposit": admission.initial_deposit,
        "insurance_approved_amount": admission.insurance_approved_amount,
        "balance_due": balance_due
    }

    return ApiResponse.success(data=data, message="Billing summary calculated successfully.")


# ── 12. POST /ipd/admissions/{id}/finalize-checkout ───────────────────────────
@router.post("/admissions/{id}/finalize-checkout", response_class=JSONResponse)
async def finalize_checkout(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Discharge patient, free bed asset to 'cleaning' state."""
    if current_user.role not in [UserRole.ADMIN, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST]:
        raise PermissionDeniedError("Only staff members can process checkout.")

    adm_res = await db.execute(select(Admission).where(Admission.id == id, Admission.admission_status != "discharged"))
    admission = adm_res.scalar_one_or_none()
    if not admission:
        raise HTTPException(status_code=404, detail="Active admission record not found.")

    # Mark admission as discharged
    admission.discharge_datetime = datetime.now(UTC)
    admission.admission_status = "discharged"

    # Set Bed status to cleaning
    bed_res = await db.execute(select(Bed).where(Bed.id == admission.bed_id))
    bed = bed_res.scalar_one_or_none()
    if bed:
        bed.status = "cleaning"
        bed.last_cleaned_at = None

    await db.flush()
    return ApiResponse.success(message="Checkout finalized successfully. Patient discharged and Bed set to Cleaning state. Please generate the invoice from the Billing module.")


@router.post("/beds/{id}/clean", response_class=JSONResponse)
async def clean_bed(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Mark bed as clean and available."""
    bed_res = await db.execute(select(Bed).where(Bed.id == id))
    bed = bed_res.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found.")
    bed.status = "available"
    bed.last_cleaned_at = datetime.now(UTC)
    await db.flush()
    return ApiResponse.success(message="Bed marked as clean and available.")


# ── 13. POST /ipd/admission-requests ─────────────────────────────────────────
@router.post("/admission-requests", response_class=JSONResponse)
async def create_admission_request(
    payload: AdmissionRequestCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Doctor advises IPD admission for a patient."""
    if payload.doctor_id:
        doctor_id = payload.doctor_id
        doc_res = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
        doctor = doc_res.scalar_one_or_none()
        doctor_name = doctor.user.full_name if (doctor and doctor.user) else "Doctor"
    else:
        doc_res = await db.execute(select(Doctor).where(Doctor.user_id == current_user.id))
        doctor = doc_res.scalar_one_or_none()
        if not doctor:
            first_doc_res = await db.execute(select(Doctor).limit(1))
            doctor = first_doc_res.scalar_one_or_none()
            if not doctor:
                raise HTTPException(status_code=400, detail="No doctor profile available.")
        doctor_id = doctor.id
        doctor_name = doctor.user.full_name if doctor.user else current_user.full_name

    patient_res = await db.execute(select(Patient).where(Patient.id == payload.patient_id))
    patient = patient_res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")

    patient_name = patient.name or (patient.user.full_name if patient.user else "Patient")

    admission_req = IpdAdmissionRequest(
        patient_id=payload.patient_id,
        doctor_id=doctor_id,
        category_id=payload.category_id,
        reason=payload.reason,
        urgency=payload.urgency,
        status="pending"
    )
    db.add(admission_req)

    # 1. Create In-App Notification for Receptionists
    rec_res = await db.execute(select(User).where(User.role == UserRole.RECEPTIONIST))
    receptionists = rec_res.scalars().all()
    for rec in receptionists:
        notif_receptionist = Notification(
            user_id=rec.id,
            title="🏥 IPD Admission Advised",
            message=f"Dr. {doctor_name} has advised IPD admission for {patient_name} ({payload.urgency.upper()}). Reason: {payload.reason}",
            type="admission_request"
        )
        db.add(notif_receptionist)

    # 2. Create Notification for Patient (if user linked)
    if patient.user_id:
        notif_patient = Notification(
            user_id=patient.user_id,
            title="🏥 IPD Admission Advised",
            message=f"Dr. {doctor_name} has advised IPD admission for your treatment. Please visit the Reception Desk for Bed Allocation.",
            type="admission_request"
        )
        db.add(notif_patient)

    await db.flush()
    return ApiResponse.success(
        data={"request_id": str(admission_req.id)},
        message=f"IPD Admission request submitted successfully for {patient_name}."
    )


# ── 14. GET /ipd/admission-requests/pending ──────────────────────────────────
@router.get("/admission-requests/pending", response_class=JSONResponse)
async def get_pending_admission_requests(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Fetch pending IPD admission requests for Receptionist/Doctor review."""
    reqs_res = await db.execute(
        select(IpdAdmissionRequest)
        .where(IpdAdmissionRequest.status == "pending")
        .order_by(IpdAdmissionRequest.requested_at.desc())
    )
    requests = reqs_res.scalars().all()

    output = []
    for r in requests:
        patient_name = r.patient.name or (r.patient.user.full_name if r.patient.user else "Patient")
        patient_code = r.patient.patient_code or "N/A"
        doc_name = r.doctor.user.full_name if (r.doctor and r.doctor.user) else "Doctor"

        output.append({
            "id": str(r.id),
            "patient_id": str(r.patient_id),
            "patient_name": patient_name,
            "patient_code": patient_code,
            "doctor_id": str(r.doctor_id),
            "doctor_name": doc_name,
            "category_id": str(r.category_id) if r.category_id else None,
            "category_name": r.category.name if r.category else None,
            "reason": r.reason,
            "urgency": r.urgency,
            "status": r.status,
            "requested_at": r.requested_at.isoformat()
        })

    return ApiResponse.success(data=output, message="Fetched pending admission requests.")


# ── 15. POST /ipd/admission-requests/{id}/fulfill ───────────────────────────
@router.post("/admission-requests/{id}/fulfill", response_class=JSONResponse)
async def fulfill_admission_request(
    id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> JSONResponse:
    """Mark an admission request as fulfilled/admitted."""
    req_res = await db.execute(select(IpdAdmissionRequest).where(IpdAdmissionRequest.id == id))
    request_obj = req_res.scalar_one_or_none()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Admission request not found.")
    
    request_obj.status = "admitted"
    request_obj.admitted_at = datetime.now(UTC)
    await db.flush()
    return ApiResponse.success(message="Admission request marked as fulfilled.")

