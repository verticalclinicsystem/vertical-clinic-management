"""
Inventory router — endpoints for managing clinic medicine stock.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.core.exceptions import PermissionDeniedError
from app.models.user import User, UserRole
from app.models.inventory import Medicine
from app.schemas.inventory import MedicineCreate, MedicineOut
from app.utils.response import ApiResponse

router = APIRouter()


@router.get("/", response_class=JSONResponse)
async def list_medicines(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    List all medicines in the inventory.
    """
    if current_user.role not in [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.ADMIN]:
         raise PermissionDeniedError("Access denied.")

    skip = (page - 1) * limit
    stmt = select(Medicine).order_by(Medicine.name).offset(skip).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    count_stmt = select(func.count(Medicine.id))
    count_result = await db.execute(count_stmt)
    total = count_result.scalar_one()

    return ApiResponse.success(
        data={
            "items": [MedicineOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "limit": limit,
        },
        message="Inventory retrieved successfully."
    )


@router.post("/", response_class=JSONResponse, status_code=201)
async def create_medicine(
    request: MedicineCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Create a new medicine in the inventory.
    - Restricted to Pharmacist and Admin.
    """
    if current_user.role not in [UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only pharmacists or admins can add medicines.")

    import uuid
    medicine = Medicine(id=uuid.uuid4(), **request.model_dump())
    db.add(medicine)
    await db.commit()
    await db.refresh(medicine)

    return ApiResponse.success(
        data=MedicineOut.model_validate(medicine),
        message="Medicine added to inventory successfully.",
        status_code=201
    )


@router.get("/purchase-orders", response_class=JSONResponse)
async def list_purchase_orders(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Return purchase (stock-in) transactions as purchase-order cards.
    """
    if current_user.role not in [UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Access denied.")

    import uuid as _uuid
    from app.models.inventory import StockTransaction

    stmt = (
        select(StockTransaction, Medicine)
        .join(Medicine, Medicine.id == StockTransaction.medicine_id)
        .where(StockTransaction.transaction_type == "purchase")
        .order_by(StockTransaction.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    orders = []
    for txn, med in rows:
        orders.append({
            "id": str(txn.id),
            "medicine_name": med.name,
            "supplier": med.supplier or "Unknown",
            "quantity": txn.change_qty,
            "unit": med.unit,
            "amount": round(txn.change_qty * med.unit_price, 2),
            "status": "Received",
            "date": txn.created_at.strftime("%d %b %Y"),
            "notes": txn.notes or "",
        })

    return ApiResponse.success(
        data={"items": orders, "total": len(orders)},
        message="Purchase orders retrieved."
    )
