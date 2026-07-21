"""
Structured logging configuration using Python's built-in logging.
JSON format in production for log aggregators (Datadog, CloudWatch, etc.).
"""
import logging
import sys
from typing import Any

from app.config import settings


class _JsonFormatter(logging.Formatter):
    """Emit log records as JSON lines."""

    def format(self, record: logging.LogRecord) -> str:
        import json
        import traceback

        data: dict[str, Any] = {
            "time": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            data["exception"] = "".join(traceback.format_exception(*record.exc_info))
        return json.dumps(data, ensure_ascii=False)


def setup_logging() -> None:
    """Configure root logger. Call once at application startup."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    if settings.LOG_JSON:
        handler.setFormatter(_JsonFormatter())
    else:
        fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
        handler.setFormatter(logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S"))

    root_logger.addHandler(handler)

    # Quiet noisy third-party loggers & disable duplicate propagation
    noisy_loggers = [
        "sqlalchemy",
        "sqlalchemy.engine",
        "sqlalchemy.engine.Engine",
        "sqlalchemy.pool",
        "sqlalchemy.orm",
        "uvicorn.access",
        "httpx",
        "httpcore",
        "asyncio",
        "passlib",
        "passlib.handlers.bcrypt",
    ]
    for name in noisy_loggers:
        l = logging.getLogger(name)
        l.setLevel(logging.WARNING)
        l.propagate = False
