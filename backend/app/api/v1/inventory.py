"""
Inventory router — endpoints for managing clinic medicine stock.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_db
from app.core.exceptions import PermissionDeniedError
from app.models.user import User, UserRole
from app.schemas.inventory import MedicineCreate, MedicineOut
from app.services.inventory_service import InventoryService
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

    service = InventoryService(db)
    items, total = await service.list_medicines(page, limit)

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

    service = InventoryService(db)
    medicine = await service.create_medicine(request)

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

    service = InventoryService(db)
    orders = await service.list_purchase_orders(limit)

    return ApiResponse.success(
        data={"items": orders, "total": len(orders)},
        message="Purchase orders retrieved."
    )


@router.post("/purchase-orders", response_class=JSONResponse, status_code=201)
async def create_purchase_order(
    request: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Record a new stock-in purchase transaction.
    """
    if current_user.role not in [UserRole.PHARMACIST, UserRole.ADMIN]:
        raise PermissionDeniedError("Only pharmacists or admins can record purchase orders.")

    from app.models.inventory import Medicine, StockTransaction
    import uuid
    from sqlalchemy import select

    med_id = uuid.UUID(request["medicine_id"])
    qty = int(request["change_qty"])
    notes = request.get("notes", "")

    stmt = select(Medicine).where(Medicine.id == med_id)
    res = await db.execute(stmt)
    med = res.scalar_one_or_none()
    if not med:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "Medicine not found."}
        )

    # Create transaction
    txn = StockTransaction(
        id=uuid.uuid4(),
        medicine_id=med_id,
        change_qty=qty,
        transaction_type="purchase",
        notes=notes,
        performed_by_id=current_user.id
    )
    db.add(txn)

    # Update stock_qty
    med.stock_qty += qty
    db.add(med)

    await db.commit()

    return ApiResponse.success(
        data={
            "id": str(txn.id),
            "medicine_name": med.name,
            "supplier": med.supplier or "Unknown",
            "quantity": txn.change_qty,
            "unit": med.unit,
            "amount": round(txn.change_qty * med.unit_price, 2),
            "status": "Received",
            "date": txn.created_at.strftime("%d %b %Y"),
            "notes": txn.notes or "",
        },
        message="Purchase order recorded successfully.",
        status_code=201
    )
