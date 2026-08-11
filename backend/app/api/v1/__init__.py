"""
API v1 router — aggregates all endpoint sub-routers.
"""
from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ai,
    appointments,
    auth,
    billing,
    branches,
    chat,
    consultation,
    doctors,
    inventory,
    medical_reports,
    notifications,
    patients,
    payments,
    pharmacy,
    prescriptions,
    teleconsultation,
    treatment_plans,
    users,
    receptionists,
    availability_requests,
    clinic_manager,
    ipd,
    audit,
)

router = APIRouter()

router.include_router(auth.router,              prefix="/auth",             tags=["Authentication"])
router.include_router(users.router,             prefix="/users",            tags=["Admin Portal"])
router.include_router(patients.router,          prefix="/patients",         tags=["Patient Portal"])
router.include_router(branches.router,          prefix="/branches",         tags=["Admin Portal"])
router.include_router(doctors.router,           prefix="/doctors",          tags=["Doctor Portal"])
router.include_router(availability_requests.router, prefix="/doctors/availability-requests", tags=["Doctor Portal"])
router.include_router(receptionists.router,     prefix="/receptionists",    tags=["Receptionist Portal"])
router.include_router(appointments.router,      prefix="/appointments",     tags=["Receptionist Portal"])
router.include_router(consultation.router,      prefix="/consultations",    tags=["Doctor Portal"])
router.include_router(prescriptions.router,     prefix="/prescriptions",    tags=["Doctor Portal"])
router.include_router(treatment_plans.router,   prefix="/treatment-plans",  tags=["Doctor Portal"])
router.include_router(billing.router,           prefix="/billing",          tags=["Billing & Payments"])
router.include_router(payments.router,          prefix="/payments",         tags=["Billing & Payments"])
router.include_router(pharmacy.router,          prefix="/pharmacy",         tags=["Pharmacy Portal"])
router.include_router(inventory.router,         prefix="/inventory",        tags=["Pharmacy Portal"])
router.include_router(medical_reports.router,   prefix="/medical-reports",  tags=["Patient Portal"])
router.include_router(teleconsultation.router,  prefix="/teleconsultation", tags=["Doctor Portal"])
router.include_router(teleconsultation.router,  prefix="/teleconsultations", tags=["Doctor Portal"])
router.include_router(chat.router,              prefix="/chat",             tags=["Direct Messaging & Patient Chat"])
router.include_router(notifications.router,     prefix="/notifications",    tags=["System & Notifications"])
router.include_router(ai.router,                prefix="/ai",               tags=["AI Assistant"])
router.include_router(admin.router,             prefix="/admin",            tags=["Admin Portal"])
router.include_router(clinic_manager.router,    prefix="/clinic-manager",   tags=["Clinic Manager Portal"])
router.include_router(ipd.router,               prefix="/ipd",              tags=["IPD Bed Management"])
router.include_router(audit.router,             prefix="/audit",            tags=["Audit Logging"])

