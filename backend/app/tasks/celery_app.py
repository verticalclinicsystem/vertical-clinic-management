"""
Celery application factory.
Workers are started separately via: celery -A app.tasks.celery_app worker
"""
from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "clinic",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.notification_tasks",
        "app.tasks.ai_tasks",
        "app.tasks.inventory_tasks",
        "app.tasks.report_tasks",
        "app.tasks.otp_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,            # re-queue if worker crashes mid-task
    worker_prefetch_multiplier=1,   # fair task distribution
    task_soft_time_limit=300,       # 5 min soft limit
    task_time_limit=600,            # 10 min hard limit
)

# ── Celery Beat Scheduled Tasks ───────────────────────────────────────────────
celery_app.conf.beat_schedule = {
    # Send appointment reminders every minute
    "send-appointment-reminders": {
        "task": "app.tasks.notification_tasks.send_appointment_reminders",
        "schedule": crontab(minute="*"),         # every minute
    },
    # Check inventory low-stock twice daily
    "check-low-stock": {
        "task": "app.tasks.inventory_tasks.check_low_stock_and_alert",
        "schedule": crontab(hour="8,18", minute="0"),
    },
    # Generate daily revenue report
    "daily-revenue-report": {
        "task": "app.tasks.report_tasks.generate_daily_revenue_report",
        "schedule": crontab(hour="23", minute="55"),
    },
    # Purge expired / used OTP records every 30 minutes
    "purge-expired-otps": {
        "task": "app.tasks.otp_tasks.purge_expired_otps",
        "schedule": crontab(minute="*/30"),   # every 30 min
    },
}
