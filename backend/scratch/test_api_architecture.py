import asyncio
import httpx
from fastapi import FastAPI, Request
from pydantic import BaseModel, Field

from app.middleware.request_tracking import RequestTrackingMiddleware
from app.exceptions.exception_handlers import register_exception_handlers
from app.utils.response import ApiResponse
from app.core.exceptions import NotFoundError

test_app = FastAPI(title="Architecture Verification Test")
test_app.add_middleware(RequestTrackingMiddleware)
register_exception_handlers(test_app)

class TestPayload(BaseModel):
    name: str = Field(..., min_length=2)
    age: int = Field(..., ge=0)

@test_app.get("/test-success")
async def test_success():
    return ApiResponse.success(data={"user": "Jane"}, message="User fetched successfully")

@test_app.get("/test-paginated")
async def test_paginated():
    return ApiResponse.paginated(items=[{"id": 1}, {"id": 2}], total=20, page=1, limit=2)

@test_app.post("/test-validation")
async def test_validation(payload: TestPayload):
    return ApiResponse.success(data=payload.model_dump())

@test_app.get("/test-domain-error")
async def test_domain_error():
    raise NotFoundError("Patient")

async def run_async_tests():
    transport = httpx.ASGITransport(app=test_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Success endpoint & headers
        res1 = await client.get("/test-success")
        print("1. Success Status:", res1.status_code)
        print("1. Headers X-Request-ID:", res1.headers.get("x-request-id"))
        print("1. Headers X-Correlation-ID:", res1.headers.get("x-correlation-id"))
        print("1. Body:", res1.json())
        assert res1.status_code == 200
        assert res1.json()["success"] is True
        assert "x-request-id" in res1.headers

        # 2. Paginated endpoint
        res2 = await client.get("/test-paginated")
        print("\n2. Paginated Body:", res2.json())
        assert res2.json()["meta"]["pagination"]["total"] == 20

        # 3. Validation Error (422)
        res3 = await client.post("/test-validation", json={"name": "A", "age": -5})
        print("\n3. Validation Error Status:", res3.status_code)
        print("3. Body:", res3.json())
        assert res3.status_code == 422
        assert res3.json()["success"] is False
        assert len(res3.json()["details"]) > 0

        # 4. Domain Error (404)
        res4 = await client.get("/test-domain-error")
        print("\n4. Domain Error Status:", res4.status_code)
        print("4. Body:", res4.json())
        assert res4.status_code == 404
        assert res4.json()["error_code"] == "NOT_FOUND"

        print("\n[SUCCESS] ALL API ARCHITECTURE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_async_tests())
