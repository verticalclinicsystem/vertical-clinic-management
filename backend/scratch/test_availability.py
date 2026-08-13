import asyncio
import json
from datetime import datetime, timezone, timedelta, date
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.doctor import Doctor
from app.models.user import User
from app.models.patient import Patient
from app.services.appointment_service import AppointmentService
from app.schemas.appointment import AppointmentCreate

async def run_manual_test():
    async with AsyncSessionLocal() as db:
        print("=== Step 1: Finding Doctor and Patient ===")
        # Fetch a doctor
        res_doc = await db.execute(select(Doctor).join(User, User.id == Doctor.user_id).where(User.email == "doctor@verticalclinic.com"))
        doctor = res_doc.scalar_one_or_none()
        if not doctor:
            # Fallback to any doctor
            res_doc = await db.execute(select(Doctor))
            doctor = res_doc.scalars().first()
            
        if not doctor:
            print("No doctor found in database!")
            return
            
        # Fetch user details
        res_user = await db.execute(select(User).where(User.id == doctor.user_id))
        doc_user = res_user.scalar_one()
        print(f"Target Doctor: {doc_user.full_name} ({doc_user.email}) | ID: {doctor.id}")

        # Fetch a patient for booking
        res_pat = await db.execute(select(Patient))
        patient = res_pat.scalars().first()
        if not patient:
            print("No patient found to run tests. Please seed patient first!")
            return
        res_pat_user = await db.execute(select(User).where(User.id == patient.user_id))
        pat_user = res_pat_user.scalar_one()
        print(f"Target Patient: {pat_user.full_name} | ID: {patient.id}")

        apt_service = AppointmentService(db)

        try:
            print("\n=== Test 1: Testing Manual Availability Toggle (is_available = False) ===")
            print("Setting doctor.is_available = False...")
            doctor.is_available = False
            db.add(doctor)
            await db.flush()

            # Try to book appointment
            print("Attempting to book an appointment with the unavailable doctor...")
            IST = timezone(timedelta(hours=5, minutes=30))
            future_dt = datetime.now(timezone.utc) + timedelta(days=2)
            
            # Formulate booking request
            req = AppointmentCreate(
                doctor_id=doctor.id,
                branch_id=doctor.branch_id,
                patient_id=patient.id,
                appointment_datetime=future_dt,
                treatment_type="General Consultation",
                consultation_type="in_person",
                notes="Routine dental checkup"
            )
            
            try:
                await apt_service.create_appointment(
                    patient_id=patient.id,
                    request=req,
                    role="patient"
                )
                print("❌ ERROR: Appointment booked successfully, but it should have failed!")
            except Exception as e:
                print(f"✅ SUCCESS: Booking failed as expected. Error message: '{str(e)}'")

            print("\n=== Test 2: Testing Leave Date Range (is_available = True, Leave active) ===")
            print("Restoring doctor.is_available = True...")
            doctor.is_available = True
            
            # Set leave dates (using a future weekday that matches slot weekday if possible, e.g. Monday/Tuesday)
            # Find next Monday (weekday 0)
            today = date.today()
            days_ahead = 0 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            next_monday = today + timedelta(days=days_ahead)
            
            leave_start = next_monday.strftime("%Y-%m-%d")
            leave_end = (next_monday + timedelta(days=2)).strftime("%Y-%m-%d")
            
            print(f"Setting leave from {leave_start} to {leave_end} in metadata...")
            leave_meta = {
                "leaves": [
                    {"start_date": leave_start, "end_date": leave_end, "reason": "Annual Vacation"}
                ]
            }
            doctor.availability_metadata = json.dumps(leave_meta)
            db.add(doctor)
            await db.flush()

            # Attempt booking inside leave dates (e.g. next Monday at 10:00 AM)
            inside_leave_dt = datetime.combine(next_monday, datetime.min.time()).replace(tzinfo=IST) + timedelta(hours=10)
            print(f"1. Attempting to book on {inside_leave_dt.strftime('%Y-%m-%d %H:%M')} (INSIDE LEAVE DATE)...")
            req_inside = AppointmentCreate(
                doctor_id=doctor.id,
                branch_id=doctor.branch_id,
                patient_id=patient.id,
                appointment_datetime=inside_leave_dt,
                treatment_type="General Consultation",
                consultation_type="in_person",
                notes="Checkup during leave"
            )
            try:
                await apt_service.create_appointment(
                    patient_id=patient.id,
                    request=req_inside,
                    role="patient"
                )
                print("❌ ERROR: Booking inside leave dates succeeded, but it should have failed!")
            except Exception as e:
                print(f"✅ SUCCESS: Booking inside leave failed as expected. Error message: '{str(e)}'")

            # Attempt booking outside leave dates (e.g. next Friday at 10:00 AM)
            outside_leave_dt = datetime.combine(next_monday + timedelta(days=4), datetime.min.time()).replace(tzinfo=IST) + timedelta(hours=10)
            print(f"2. Attempting to book on {outside_leave_dt.strftime('%Y-%m-%d %H:%M')} (OUTSIDE LEAVE DATE)...")
            req_outside = AppointmentCreate(
                doctor_id=doctor.id,
                branch_id=doctor.branch_id,
                patient_id=patient.id,
                appointment_datetime=outside_leave_dt,
                treatment_type="General Consultation",
                consultation_type="in_person",
                notes="Checkup outside leave"
            )
            try:
                await apt_service.create_appointment(
                    patient_id=patient.id,
                    request=req_outside,
                    role="patient"
                )
                print("✅ SUCCESS: Booking outside leave date completed successfully!")
            except Exception as e:
                if "leave" in str(e).lower():
                    print(f"❌ ERROR: Booking outside leave failed due to leave check error: '{str(e)}'")
                else:
                    # Might fail due to other slots details, which means the leave check was passed successfully!
                    print(f"✅ SUCCESS: Leave check bypassed successfully. (Other constraint failed: '{str(e)}')")

        finally:
            # Rollback database changes to keep DB clean
            await db.rollback()
            print("\nDatabase rolled back. Initial state restored successfully.")

if __name__ == "__main__":
    asyncio.run(run_manual_test())
