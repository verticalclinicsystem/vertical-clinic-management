"""
Import all models here so SQLAlchemy's mapper registry is fully populated
before any query is compiled. Without this, lazy string references in
relationship() declarations fail with InvalidRequestError.
"""
from app.models.user import User  # noqa: F401
from app.models.branch import Branch  # noqa: F401
from app.models.patient import Patient  # noqa: F401
from app.models.doctor import Doctor  # noqa: F401
from app.models.teleconsult import TeleConsultation  # noqa: F401
from app.models.consultation import Consultation  # noqa: F401
from app.models.appointment import Appointment  # noqa: F401
from app.models.invoice import Invoice  # noqa: F401
from app.models.payment import Payment  # noqa: F401
from app.models.prescription import Prescription  # noqa: F401
from app.models.inventory import Medicine  # noqa: F401
from app.models.medical_report import MedicalReport  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.otp import OtpRecord  # noqa: F401
from app.models.treatment import TreatmentPlan, TreatmentProcedure  # noqa: F401
from app.models.receptionist import Receptionist  # noqa: F401
from app.models.availability_request import AvailabilityChangeRequest  # noqa: F401
from app.models.chat import ChatMessage  # noqa: F401
from app.models.system_setting import SystemSetting  # noqa: F401
from app.models.attendance import Attendance  # noqa: F401
from app.models.ipd import (  # noqa: F401
    BedCategory, Bed, Admission, BedTransferLog,
    IpdClinicalRecord, IpdMedicationAdministration, IpdBillItem, IpdAdmissionRequest
)

__all__ = [
    "User", "Branch", "Patient", "Doctor", "Appointment",
    "TeleConsultation", "Consultation", "Invoice", "Payment",
    "Prescription", "Medicine", "MedicalReport", "Notification",
    "OtpRecord", "TreatmentPlan", "TreatmentProcedure", "Receptionist",
    "AvailabilityChangeRequest", "ChatMessage", "SystemSetting", "Attendance",
    "BedCategory", "Bed", "Admission", "BedTransferLog",
    "IpdClinicalRecord", "IpdMedicationAdministration", "IpdBillItem", "IpdAdmissionRequest",
]

