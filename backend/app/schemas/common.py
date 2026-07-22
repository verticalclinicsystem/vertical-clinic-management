"""
Common reusable Pydantic schemas for response wrappers, pagination, errors, and shared data objects.
"""
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationInfo(BaseModel):
    """Metadata for paginated lists."""
    total: int = Field(..., description="Total item count across all pages", ge=0)
    page: int = Field(..., description="Current page number (1-indexed)", ge=1)
    limit: int = Field(..., description="Items requested per page", ge=1)
    pages: int = Field(..., description="Total available pages", ge=0)


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic standard response wrapper for paginated endpoints."""
    success: bool = Field(True, description="Indicates if request succeeded")
    message: str = Field("Request successful", description="Human-readable summary message")
    data: List[T] = Field(default_factory=list, description="List of items for current page")
    pagination: PaginationInfo = Field(..., description="Pagination metadata")


class StandardResponse(BaseModel, Generic[T]):
    """Generic standard response wrapper for single item or payload responses."""
    success: bool = Field(True, description="Indicates if request succeeded")
    message: str = Field("Request successful", description="Human-readable summary message")
    data: Optional[T] = Field(None, description="Response payload data")


class ErrorDetail(BaseModel):
    """Structured detail for individual field or parameter validation error."""
    field: Optional[str] = Field(None, description="Cleaned field path where error occurred")
    message: str = Field(..., description="Error message description")
    type: Optional[str] = Field(None, description="Validation error type identifier")


class ErrorResponse(BaseModel):
    """Standardized API error response format."""
    success: bool = Field(False, description="Always False for error responses")
    message: str = Field(..., description="Human-readable error description")
    error_code: Optional[str] = Field(None, description="Machine-readable error code")
    path: Optional[str] = Field(None, description="Endpoint path where error occurred")
    timestamp: str = Field(..., description="UTC ISO format timestamp of the error")
    details: Optional[List[ErrorDetail]] = Field(None, description="Structured validation error list")
    developer_hint: Optional[str] = Field(None, description="Developer hint active in non-production environments")


class PriceBreakdown(BaseModel):
    """Shared financial price breakdown model."""
    subtotal: float = Field(..., description="Subtotal before taxes and discounts", ge=0)
    tax: float = Field(0.0, description="Calculated tax amount", ge=0)
    discount: float = Field(0.0, description="Discount amount applied", ge=0)
    total: float = Field(..., description="Final payable total amount", ge=0)


class LocationDetail(BaseModel):
    """Shared location address details model."""
    address: str = Field(..., description="Street address line")
    city: str = Field(..., description="City name")
    state: Optional[str] = Field(None, description="State or province name")
    zip_code: Optional[str] = Field(None, description="Postal or zip code")
    country: str = Field("India", description="Country name")


class DateRangeFilter(BaseModel):
    """Shared date range filter query params."""
    start_date: Optional[str] = Field(None, description="Filter start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Filter end date (YYYY-MM-DD)")
