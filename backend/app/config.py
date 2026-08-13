from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AnyUrl, Field, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central configuration loaded from environment variables / .env file.
    All fields are strongly typed and validated on startup.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str
    APP_ENV: Literal["development", "staging", "production"]
    APP_VERSION: str
    DEBUG: bool

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int

    # ── OTP ──────────────────────────────────────────────────────────────────
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str                       # asyncpg URL for async ops
    SYNC_DATABASE_URL: str                  # psycopg2 URL for Alembic migrations

    # ── Redis & Celery ───────────────────────────────────────────────────────
    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    # ── AI Provider ──────────────────────────────────────────────────────────
    AI_PROVIDER: Literal["groq", "gemini", "ollama"]
    GROQ_API_KEY: str
    GROQ_MODEL: str
    GEMINI_API_KEY: str
    GEMINI_MODEL: str
    OLLAMA_BASE_URL: str
    OLLAMA_MODEL: str

    # ── Stripe ───────────────────────────────────────────────────────────────
    STRIPE_SECRET_KEY: str
    STRIPE_PUBLISHABLE_KEY: str
    STRIPE_WEBHOOK_SECRET: str
    STRIPE_CURRENCY: str

    # ── File Storage ─────────────────────────────────────────────────────────
    STORAGE_BACKEND: Literal["local", "s3", "cloudinary"]
    UPLOAD_DIR: str
    MAX_UPLOAD_SIZE_MB: int

    CLOUDINARY_CLOUD_NAME: str = "ohlztt2b"
    CLOUDINARY_API_KEY: str = "822696216758164"
    CLOUDINARY_API_SECRET: str = "7Q1IvXRvLDFBsYOkzJ_U_UxeRKU"

    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str
    AWS_S3_BUCKET: str

    # ── Email ────────────────────────────────────────────────────────────────
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASSWORD: str
    FROM_EMAIL: str
    FROM_NAME: str
    MAILGUN_API_KEY: str = ""
    MAILGUN_DOMAIN: str = ""

    # ── SMS ──────────────────────────────────────────────────────────────────
    SMS_PROVIDER: Literal["twilio", "fast2sms"]
    FAST2SMS_API_KEY: str
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_FROM_NUMBER: str

    # ── WhatsApp ─────────────────────────────────────────────────────────────
    WHATSAPP_PROVIDER: str
    WHATSAPP_TOKEN: str
    WHATSAPP_PHONE_NUMBER_ID: str

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str

    # ── Logging ──────────────────────────────────────────────────────────────
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"]
    LOG_JSON: bool

    # ── Appointment Reminders ────────────────────────────────────────────────
    REMINDER_HOURS_BEFORE: int

    # ── Computed properties ──────────────────────────────────────────────────
    @computed_field
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @model_validator(mode="after")
    def validate_ai_keys(self) -> Settings:
        if self.AI_PROVIDER == "groq" and not self.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is required when AI_PROVIDER=groq")
        if self.AI_PROVIDER == "gemini" and not self.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")
        return self

    @model_validator(mode="after")
    def validate_stripe_keys(self) -> Settings:
        # Only enforce in production
        if self.is_production and not self.STRIPE_SECRET_KEY:
            raise ValueError("STRIPE_SECRET_KEY is required in production")
        return self


@lru_cache
def get_settings() -> Settings:
    """
    Returns a cached singleton Settings instance.
    Use this everywhere instead of constructing Settings() directly.
    """
    return Settings()


# Convenience alias used across the project
settings = get_settings()
