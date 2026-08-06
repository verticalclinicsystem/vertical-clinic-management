import asyncio
import json
import uuid
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.doctor import Doctor, DoctorSlot
from app.models.user import User, UserRole
from app.models.branch import Branch

async def ensure_doctor_profile(email: str):
    async with AsyncSessionLocal() as db:
        print(f"Checking user with email: {email}")
        
        # 1. Fetch User
        stmt = select(User).where(User.email == email)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()
        
        if not user:
            print(f"User with email '{email}' not found in 'users' table!")
            return
            
        print(f"User found: ID={user.id}, Name='{user.full_name}', Role='{user.role}', BranchID={user.branch_id}")
        
        # 2. Ensure Role is Doctor
        if user.role != UserRole.DOCTOR:
            print(f"Updating user role from '{user.role}' to 'doctor'...")
            user.role = UserRole.DOCTOR
            db.add(user)
            await db.flush()

        # 3. Fetch or Create Doctor Profile
        stmt_doc = select(Doctor).where(Doctor.user_id == user.id)
        res_doc = await db.execute(stmt_doc)
        doctor = res_doc.scalar_one_or_none()
        
        if doctor:
            print(f"Doctor profile already exists: ID={doctor.id}, Specialization='{doctor.specialization}'")
        else:
            print("Doctor profile is MISSING! Creating profile now...")
            
            # Fetch a fallback branch if user has none
            branch_id = user.branch_id
            if not branch_id:
                stmt_branch = select(Branch)
                res_branch = await db.execute(stmt_branch)
                branch = res_branch.scalars().first()
                if branch:
                    branch_id = branch.id
                    print(f"Assigned branch: {branch.name}")
                    user.branch_id = branch_id
                    db.add(user)
                else:
                    print("Error: No branches found in the database. Please seed branches first.")
                    return

            default_meta = {
                "lunch_start": "13:00",
                "lunch_end": "14:00",
                "tele_start": "15:00",
                "tele_end": "17:00",
                "leaves": []
            }

            doctor = Doctor(
                id=uuid.uuid4(),
                user_id=user.id,
                branch_id=branch_id,
                specialization="General Dentist",
                qualification="BDS",
                experience_years=5,
                consultation_fee=500.0,
                rating=4.8,
                bio="Experienced dentist specializing in general dentistry and patient care.",
                is_available=True,
                availability_metadata=json.dumps(default_meta)
            )
            db.add(doctor)
            await db.flush()
            print(f"Doctor profile created successfully with ID: {doctor.id}")

        # 4. Ensure weekly availability slots exist
        stmt_slots = select(DoctorSlot).where(DoctorSlot.doctor_id == doctor.id)
        res_slots = await db.execute(stmt_slots)
        slots = res_slots.scalars().all()
        
        if len(slots) > 0:
            print(f"Doctor already has {len(slots)} availability slots seeded.")
        else:
            print("Seeding default weekly availability slots (Mon-Sat: 09:00-13:00, 14:00-21:00)...")
            for w in range(6):  # Monday (0) to Saturday (5)
                slot1 = DoctorSlot(
                    id=uuid.uuid4(),
                    doctor_id=doctor.id,
                    weekday=w,
                    start_time="09:00",
                    end_time="13:00",
                    slot_duration_minutes=30,
                    is_active=True
                )
                slot2 = DoctorSlot(
                    id=uuid.uuid4(),
                    doctor_id=doctor.id,
                    weekday=w,
                    start_time="14:00",
                    end_time="21:00",
                    slot_duration_minutes=30,
                    is_active=True
                )
                db.add_all([slot1, slot2])
            
            # Sunday slot
            slot_sunday = DoctorSlot(
                id=uuid.uuid4(),
                doctor_id=doctor.id,
                weekday=6,
                start_time="09:00",
                end_time="14:00",
                slot_duration_minutes=30,
                is_active=True
            )
            db.add(slot_sunday)
            print("Weekly slots seeded.")

        await db.commit()
        print("All changes committed successfully!")

if __name__ == "__main__":
    # Specify the email of the user you want to make a doctor here:
    target_email = "kartikk.brainerhub@gmail.com"
    asyncio.run(ensure_doctor_profile(target_email))
