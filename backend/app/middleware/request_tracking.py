"""
Request tracking middleware for tracing and observability.
"""
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("app.middleware.request_tracking")


class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts or generates request & correlation IDs,
    attaches them to request state and response headers, and logs execution timing.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        correlation_id = request.headers.get("X-Correlation-ID") or request_id

        # Attach to request state for downstream handlers / logging
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        start_time = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"❌ [REQ_ID: {request_id}] {request.method} {request.url.path} failed in {duration_ms:.2f}ms"
            )
            raise

        duration_ms = (time.perf_counter() - start_time) * 1000

        # Inject tracing headers into response
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"

        logger.info(
            f"HTTP {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.2f}ms) [req_id={request_id}]"
        )

        return response
