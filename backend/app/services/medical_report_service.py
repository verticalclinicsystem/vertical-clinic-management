"""
MedicalReport service — business logic for uploading, querying, and deleting medical reports.
"""
import logging
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.medical_report import MedicalReport
from app.repositories.medical_report_repo import MedicalReportRepository
from app.repositories.patient_repo import PatientRepository

logger = logging.getLogger(__name__)


class MedicalReportService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.report_repo = MedicalReportRepository(db)
        self.patient_repo = PatientRepository(db)

    async def create_report(
        self, user_id: uuid.UUID, report_type: str, report_name: str, file_url: str
    ) -> MedicalReport:
        """Create a new medical report for the authenticated patient user."""
        patient = await self.patient_repo.get_by_user_id(user_id)
        if not patient:
            raise NotFoundError("Patient profile not found.")

        report = await self.report_repo.create({
            "patient_id": patient.id,
            "report_type": report_type,
            "report_name": report_name,
            "file_url": file_url,
        })
        await self.db.commit()
        logger.info(f"Medical report created for patient {patient.patient_code}: {report.id}")

        # Send Medical Report notification
        try:
            from app.services.notification_service import NotificationService
            noti_service = NotificationService(self.db)
            await noti_service.send_multichannel_notification(
                user_id=user_id,
                title="Medical Report Uploaded",
                message=f"Your new medical report ({report_name}) has been uploaded and is ready to view.",
                type="report"
            )
        except Exception as e:
            logger.error(f"Failed to send medical report notification: {e}")

        return report

    async def create_report_for_patient(
        self, patient_id: uuid.UUID, report_type: str, report_name: str, file_url: str
    ) -> MedicalReport:
        """Create a new medical report directly for a patient ID (used by staff on behalf of a patient)."""
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise NotFoundError("Patient profile not found.")

        report = await self.report_repo.create({
            "patient_id": patient.id,
            "report_type": report_type,
            "report_name": report_name,
            "file_url": file_url,
        })
        await self.db.commit()
        logger.info(f"Medical report created by staff for patient {patient.patient_code}: {report.id}")

        # Send Medical Report notification
        try:
            from app.services.notification_service import NotificationService
            noti_service = NotificationService(self.db)
            await noti_service.send_multichannel_notification(
                user_id=patient.user_id,
                title="Medical Report Uploaded",
                message=f"Your new medical report ({report_name}) has been uploaded and is ready to view.",
                type="report"
            )
        except Exception as e:
            logger.error(f"Failed to send medical report notification: {e}")

        return report

    async def get_reports_by_user_id(self, user_id: uuid.UUID) -> list[MedicalReport]:
        """Retrieve all medical reports for the authenticated patient user."""
        patient = await self.patient_repo.get_by_user_id(user_id)
        if not patient:
            raise NotFoundError("Patient profile not found.")
        return await self.report_repo.get_by_patient_id(patient.id)

    async def get_reports_by_patient_id(self, patient_id: uuid.UUID) -> list[MedicalReport]:
        """Retrieve all medical reports for a patient ID (used by staff)."""
        return await self.report_repo.get_by_patient_id(patient_id)

    async def delete_report(
        self, user_id: uuid.UUID, user_role: str, report_id: uuid.UUID
    ) -> None:
        """Delete a medical report if owner (patient) or admin."""
        report = await self.report_repo.get_by_id(report_id)
        if not report:
            raise NotFoundError("Medical report not found.")

        # Auth check
        if user_role not in ["admin", "receptionist", "doctor"]:
            patient = await self.patient_repo.get_by_user_id(user_id)
            if not patient or report.patient_id != patient.id:
                raise PermissionDeniedError("You do not have permission to delete this report.")

        # Delete actual file from storage
        try:
            from app.services.storage_service import StorageService
            await StorageService.delete_medical_report(report.file_url)
        except Exception as e:
            logger.error(f"Failed to delete medical report file {report.file_url}: {e}")

        await self.report_repo.delete(report)
        await self.db.commit()
        logger.info(f"Medical report deleted: {report_id}")
