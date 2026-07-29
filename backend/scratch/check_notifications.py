import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.notification import Notification
from app.models.user import User
from app.models.patient import Patient

async def main():
    async with AsyncSessionLocal() as db:
        stmt_user = select(User).where(User.email == "kartikk.brainerhub@gmail.com")
        res_user = await db.execute(stmt_user)
        user = res_user.scalar_one_or_none()
        if not user:
            print("User not found")
            return
        
        print(f"User ID: {user.id}")
        
        stmt_pat = select(Patient).where(Patient.user_id == user.id)
        res_pat = await db.execute(stmt_pat)
        patient = res_pat.scalar_one_or_none()
        if patient:
            print(f"Patient ID: {patient.id}")
            print(f"Preferences - Email: {patient.notification_email}, SMS: {patient.notification_sms}, Push: {patient.notification_push}")
        else:
            print("Patient profile not found")

        stmt_notif = select(Notification).where(Notification.user_id == user.id)
        res_notif = await db.execute(stmt_notif)
        notifications = res_notif.scalars().all()
        print(f"Total notifications: {len(notifications)}")
        for n in notifications:
            print(f"- Title: {n.title} | Message: {n.message} | Is Read: {n.is_read}")

if __name__ == "__main__":
    asyncio.run(main())
