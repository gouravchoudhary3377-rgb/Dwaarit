"""Store Manager Portal — scoped endpoints.

A store manager is a back-office user (role=store_manager) linked to a single
store document (stores.manager_id). They can:
  • see dashboard stats scoped to their store
  • view & accept incoming orders for their store
  • assign a rider to an order
  • view drivers attached to their store
  • view & update inventory (stock) for products

Super-admin can call these endpoints too with optional ?store_id= override
for oversight.

Legacy orders that have no store_id are treated as belonging to the
manager's store (so a single store manager naturally inherits all unscoped
orders during MVP).  When the manager accepts an order, we stamp the
store_id on the order doc.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from security import require_store_manager, _effective_role


router = APIRouter(tags=["store"], prefix="/store")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _public(d: dict) -> dict:
    return {k: v for k, v in d.items() if k != "_id"}


async def _manager_store(user: dict, override_id: Optional[str] = None) -> dict:
    """Resolve the store assigned to this user.

    • store_manager → the store where stores.manager_id == user.user_id
    • super_admin   → may pass ?store_id=… ; if omitted, picks first active store
    """
    role = _effective_role(user)
    if role == "super_admin":
        if override_id:
            s = await db.stores.find_one({"store_id": override_id}, {"_id": 0})
        else:
            s = await db.stores.find_one({"is_active": True}, {"_id": 0}, sort=[("created_at", 1)])
        if not s:
            raise HTTPException(404, "No store available")
        return s

    s = await db.stores.find_one({"manager_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(403, "No store linked to this manager")
    return s


# ---------------------------------------------------------------------------
#  /store/me  – profile + store
# ---------------------------------------------------------------------------
@router.get("/me")
async def store_me(user: dict = Depends(require_store_manager)):
    store = None
    try:
        store = await _manager_store(user)
    except HTTPException:
        store = None
    return {
        "manager": {
            "user_id": user.get("user_id"),
            "email": user.get("email"),
            "name": user.get("name", "Store Manager"),
            "role": user.get("role"),
            "picture": user.get("picture"),
            "mobile": user.get("mobile"),
        },
        "store": store,
    }


# ---------------------------------------------------------------------------
#  /store/dashboard  – KPI snapshot
# ---------------------------------------------------------------------------
@router.get("/dashboard")
async def store_dashboard(
    store_id: Optional[str] = Query(default=None),
    user: dict = Depends(require_store_manager),
):
    store = await _manager_store(user, store_id)
    sid = store["store_id"]

    # Orders scoped to this store OR unscoped legacy orders
    scope_q = {"$or": [{"store_id": sid}, {"store_id": {"$exists": False}}, {"store_id": None}]}

    start_today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start_week = start_today - timedelta(days=7)

    pending = await db.orders.count_documents({**scope_q, "status": {"$in": ["pending"]}})
    in_progress = await db.orders.count_documents(
        {**scope_q, "status": {"$in": ["confirmed", "preparing", "out_for_delivery"]}}
    )
    delivered_today = await db.orders.count_documents(
        {**scope_q, "status": "delivered", "updated_at": {"$gte": start_today}}
    )
    delivered_week = await db.orders.count_documents(
        {**scope_q, "status": "delivered", "updated_at": {"$gte": start_week}}
    )

    # Revenue today (sum of delivered totals)
    rev_pipeline = [
        {"$match": {**scope_q, "status": "delivered", "updated_at": {"$gte": start_today}}},
        {"$group": {"_id": None, "sum": {"$sum": "$total"}}},
    ]
    rev_agg = await db.orders.aggregate(rev_pipeline).to_list(1)
    revenue_today = round(float(rev_agg[0]["sum"]) if rev_agg else 0.0, 2)

    drivers_total = await db.drivers.count_documents({"store_id": sid})
    drivers_online = await db.drivers.count_documents(
        {"store_id": sid, "status": "approved", "online": True}
    )

    low_stock = await db.products.count_documents({"stock": {"$lte": 5}})
    out_of_stock = await db.products.count_documents({"stock": {"$lte": 0}})

    return {
        "store": store,
        "orders": {
            "pending": pending,
            "in_progress": in_progress,
            "delivered_today": delivered_today,
            "delivered_week": delivered_week,
        },
        "revenue_today": revenue_today,
        "drivers": {"total": drivers_total, "online": drivers_online},
        "inventory": {"low_stock": low_stock, "out_of_stock": out_of_stock},
    }


# ---------------------------------------------------------------------------
#  /store/orders  – list & manage
# ---------------------------------------------------------------------------
@router.get("/orders")
async def list_store_orders(
    status: Optional[str] = Query(default=None),
    store_id: Optional[str] = Query(default=None),
    user: dict = Depends(require_store_manager),
):
    store = await _manager_store(user, store_id)
    sid = store["store_id"]
    q: dict = {"$or": [{"store_id": sid}, {"store_id": {"$exists": False}}, {"store_id": None}]}
    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        q["status"] = {"$in": statuses} if len(statuses) > 1 else statuses[0]
    docs = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@router.get("/orders/{order_id}")
async def get_store_order(order_id: str, user: dict = Depends(require_store_manager)):
    store = await _manager_store(user)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("store_id") and order["store_id"] != store["store_id"]:
        raise HTTPException(403, "Order belongs to another store")
    return order


class _StatusBody(BaseModel):
    status: str = Field(min_length=1)


@router.post("/orders/{order_id}/accept")
async def accept_order(order_id: str, user: dict = Depends(require_store_manager)):
    """Manager accepts a pending order → 'confirmed', stamps store_id."""
    store = await _manager_store(user)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("status") not in ("pending", None):
        raise HTTPException(400, f"Cannot accept order in status '{order.get('status')}'")
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "confirmed", "store_id": store["store_id"], "updated_at": _now()}},
    )
    return {"ok": True, "status": "confirmed"}


@router.post("/orders/{order_id}/status")
async def update_store_order_status(
    order_id: str, body: _StatusBody, user: dict = Depends(require_store_manager)
):
    """Manager moves order through preparing → out_for_delivery."""
    allowed = {"confirmed", "preparing", "out_for_delivery", "cancelled"}
    if body.status not in allowed:
        raise HTTPException(400, f"Invalid status; must be one of {sorted(allowed)}")
    store = await _manager_store(user)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("store_id") and order["store_id"] != store["store_id"]:
        raise HTTPException(403, "Order belongs to another store")
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": body.status, "store_id": store["store_id"], "updated_at": _now()}},
    )
    return {"ok": True, "status": body.status}


class _AssignBody(BaseModel):
    driver_id: str


@router.post("/orders/{order_id}/assign-rider")
async def assign_rider(
    order_id: str, body: _AssignBody, user: dict = Depends(require_store_manager)
):
    store = await _manager_store(user)
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("store_id") and order["store_id"] != store["store_id"]:
        raise HTTPException(403, "Order belongs to another store")
    driver = await db.drivers.find_one({"driver_id": body.driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(404, "Driver not found")
    if driver.get("status") != "approved":
        raise HTTPException(400, "Driver is not approved")
    # Manager can only assign drivers from their own store (super_admin bypass)
    if _effective_role(user) != "super_admin" and driver.get("store_id") != store["store_id"]:
        raise HTTPException(403, "Driver does not belong to this store")
    upd = {
        "driver_id": body.driver_id,
        "driver_name": driver.get("name"),
        "driver_phone": driver.get("phone"),
        "driver_vehicle": driver.get("vehicle_type"),
        "driver_status": "assigned",
        "store_id": store["store_id"],
        "status": "out_for_delivery"
        if order.get("status") in ("confirmed", "preparing")
        else order.get("status", "out_for_delivery"),
        "assigned_at": _now(),
        "updated_at": _now(),
    }
    await db.orders.update_one({"order_id": order_id}, {"$set": upd})
    return {"ok": True, **upd, "assigned_at": upd["assigned_at"].isoformat()}


# ---------------------------------------------------------------------------
#  /store/drivers  – list (scoped)
# ---------------------------------------------------------------------------
@router.get("/drivers")
async def list_store_drivers(
    status: Optional[str] = Query(default=None),
    store_id: Optional[str] = Query(default=None),
    user: dict = Depends(require_store_manager),
):
    store = await _manager_store(user, store_id)
    q: dict = {"store_id": store["store_id"]}
    if status:
        q["status"] = status
    docs = await db.drivers.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


# ---------------------------------------------------------------------------
#  /store/products  – inventory
# ---------------------------------------------------------------------------
@router.get("/products")
async def list_store_products(
    q: Optional[str] = Query(default=None),
    low_stock: bool = Query(default=False),
    category: Optional[str] = Query(default=None),
    user: dict = Depends(require_store_manager),
):
    await _manager_store(user)  # ensure caller has a store
    filt: dict = {}
    if q:
        filt["name"] = {"$regex": q, "$options": "i"}
    if low_stock:
        filt["stock"] = {"$lte": 5}
    if category:
        filt["category"] = category
    docs = await db.products.find(filt, {"_id": 0}).sort("name", 1).to_list(500)
    return docs


class _StockBody(BaseModel):
    stock: int = Field(ge=0)


@router.patch("/products/{product_id}/stock")
async def update_stock(
    product_id: str, body: _StockBody, user: dict = Depends(require_store_manager)
):
    await _manager_store(user)
    res = await db.products.update_one(
        {"product_id": product_id}, {"$set": {"stock": int(body.stock)}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Product not found")
    return {"ok": True, "product_id": product_id, "stock": int(body.stock)}
