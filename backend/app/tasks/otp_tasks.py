"""
otp_tasks — periodic cleanup of expired / used OTP records.

Scheduled via Celery Beat (registered in celery_app.py).
Uses a synchronous psycopg2 connection (SYNC_DATABASE_URL) because
Celery workers are synchronous by default.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine, delete, or_
from sqlalchemy.orm import Session

from app.config import settings
from app.models.otp import OtpRecord
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# ── Synchronous engine (Celery workers are sync) ──────────────────────────────
_engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)


@celery_app.task(name="app.tasks.otp_tasks.purge_expired_otps", bind=True)
def purge_expired_otps(self) -> dict:
    """
    Delete OTP records that are either:
      • expired  (expires_at < now)
      • already used (is_used = True)

    Runs every 30 minutes via Celery Beat.
    Returns a summary dict for logging / monitoring.
    """
    now = datetime.now(timezone.utc)

    try:
        with Session(_engine) as session:
            result = session.execute(
                delete(OtpRecord).where(
                    or_(
                        OtpRecord.expires_at < now,
                        OtpRecord.is_used.is_(True),
                    )
                )
            )
            session.commit()
            deleted = result.rowcount

        logger.info("OTP cleanup: deleted %d expired/used records", deleted)
        return {"deleted": deleted, "ran_at": now.isoformat()}

    except Exception as exc:
        logger.error("OTP cleanup failed: %s", exc)
        raise self.retry(exc=exc, countdown=60, max_retries=3)
