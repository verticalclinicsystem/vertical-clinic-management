"""
Middleware module for the FastAPI backend.
"""
from app.middleware.request_tracking import RequestTrackingMiddleware

__all__ = ["RequestTrackingMiddleware"]
