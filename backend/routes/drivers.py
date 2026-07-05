"""Driver & Store management endpoints.

Covers:
  • Super-Admin driver onboarding, listing, updates, approvals
  • Store CRUD (super-admin)
  • Rider self-service (toggle online, location ping, assigned orders, earnings)
  • Public rider application (onboarding lead capture)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from database import db
from models import (
    DriverIn,
    DriverUpdate,
    OrderAssignIn,
    RiderApplicationIn,
    RiderLocationIn,
    RiderOnlineIn,
    StoreIn,
    StoreUpdate,
)
from security import (
    get_current_user,
    require_admin,
    require_rider,
    require_staff,
    require_super_admin,
)
from security import hash_password


router = APIRouter(tags=["drivers"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _public_driver(d: dict) -> dict:
    d = {k: v for k, v in d.items() if k != "_id"}
    return d


async def _audit(actor: dict, action: str, target: str = "", meta: Optional[dict] = None) -> None:
    try:
        await db.audit_logs.insert_one({
            "user_id": actor.get("user_id"),
            "actor_email": actor.get("email"),
            "actor_role": actor.get("role"),
            "action": action,
            "target": target,
            "meta": meta or {},
            "created_at": _now(),
        })
    except Exception:
        pass


# ============================================================
#  STORES
# ============================================================
@router.get("/admin/stores")
async def list_stores(_: dict = Depends(require_staff)):
    docs = await db.stores.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for s in (docs or []):
        s["driver_count"] = await db.drivers.count_documents({"store_id": s["store_id"]})
        s["inventory_count"] = await db.store_inventory.count_documents({"store_id": s["store_id"]})
        s["products_count"] = await db.store_inventory.count_documents({"store_id": s["store_id"], "is_available": True})
    return docs


@router.get("/admin/stores/{store_id}")
async def get_store(store_id: str, _: dict = Depends(require_staff)):
    doc = await db.stores.find_one({"store_id": store_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Store not found")
    doc["inventory_count"] = await db.store_inventory.count_documents({"store_id": store_id})
    doc["products_count"] = await db.store_inventory.count_documents({"store_id": store_id, "is_available": True})
    doc["pending_orders"] = await db.orders.count_documents({"store_id": store_id, "status": {"$in": ["pending", "accepted", "out_for_delivery"]}})
    doc["completed_orders"] = await db.orders.count_documents({"store_id": store_id, "status": "delivered"})
    pipeline = [
        {"$match": {"store_id": store_id, "status": "delivered"}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}}},
    ]
    rev = await db.orders.aggregate(pipeline).to_list(1)
    doc["revenue"] = rev[0]["revenue"] if rev else 0.0
    return doc


async def _next_store_code() -> str:
    """Generate next sequential store code: STR001, STR002, …"""
    count = await db.stores.count_documents({})
    for attempt in range(count + 1, count + 200):
        code = f"STR{attempt:03d}"
        if not await db.stores.find_one({"code": code}):
            return code
    return f"STR{uuid.uuid4().hex[:4].upper()}"


@router.post("/admin/stores")
async def create_store(body: StoreIn, admin: dict = Depends(require_admin)):
    code = body.code.strip() if body.code else await _next_store_code()
    if await db.stores.find_one({"code": code}):
        raise HTTPException(409, f"Store code '{code}' already exists")
    doc = {
        "store_id": f"store_{uuid.uuid4().hex[:10]}",
        "name": body.name,
        "code": code,
        "manager_name": body.manager_name,
        "phone": body.phone,
        "email": body.email,
        "manager_email": str(body.manager_email) if body.manager_email else None,
        "gst_number": body.gst_number,
        "address": body.address,
        "city": body.city,
        "state": body.state,
        "pincode": body.pincode,
        "lat": body.lat,
        "lng": body.lng,
        "delivery_radius_km": body.delivery_radius_km,
        "open_time": body.open_time,
        "close_time": body.close_time,
        "manager_id": None,
        "is_active": body.is_active,
        "created_at": _now(),
    }
    if body.manager_email:
        manager = await db.users.find_one({"email": str(body.manager_email).lower()})
        if manager:
            doc["manager_id"] = manager["user_id"]
            if manager.get("role") in ("customer", None):
                await db.users.update_one(
                    {"user_id": manager["user_id"]}, {"$set": {"role": "store_manager"}}
                )
    await db.stores.insert_one(doc)
    doc.pop("_id", None)
    await _audit(admin, "store.create", doc["store_id"])
    return doc


@router.patch("/admin/stores/{store_id}")
async def update_store(store_id: str, body: StoreUpdate, admin: dict = Depends(require_admin)):
    upd = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not upd:
        raise HTTPException(400, "No changes")
    upd["updated_at"] = _now()
    res = await db.stores.update_one({"store_id": store_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Store not found")
    await _audit(admin, "store.update", store_id, upd)
    doc = await db.stores.find_one({"store_id": store_id}, {"_id": 0})
    return doc


@router.delete("/admin/stores/{store_id}")
async def delete_store(store_id: str, admin: dict = Depends(require_admin)):
    active_orders = await db.orders.count_documents({
        "store_id": store_id,
        "status": {"$in": ["pending", "accepted", "out_for_delivery"]},
    })
    if active_orders > 0:
        raise HTTPException(400, f"Store has {active_orders} active order(s). Complete or cancel them first.")
    if await db.drivers.count_documents({"store_id": store_id}) > 0:
        raise HTTPException(400, "Store has drivers — reassign them first")
    await db.stores.delete_one({"store_id": store_id})
    await db.store_inventory.delete_many({"store_id": store_id})
    await _audit(admin, "store.delete", store_id)
    return {"ok": True}


# ============================================================
#  DRIVERS — Super-Admin
# ============================================================
@router.get("/admin/drivers")
async def admin_list_drivers(
    q: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    store_id: Optional[str] = Query(default=None),
    _: dict = Depends(require_staff),
):
    filt: dict = {}
    if status:
        filt["status"] = status
    if store_id:
        filt["store_id"] = store_id
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"vehicle_number": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.drivers.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)

    # attach order count + earnings
    driver_ids = [d["driver_id"] for d in docs]
    earnings_map: dict = {}
    if driver_ids:
        async for s in db.orders.aggregate([
            {"$match": {"driver_id": {"$in": driver_ids}, "status": "delivered"}},
            {"$group": {
                "_id": "$driver_id",
                "deliveries": {"$sum": 1},
                "earnings": {"$sum": {"$ifNull": ["$delivery_fee", 25.0]}},
            }},
        ]):
            earnings_map[s["_id"]] = {
                "deliveries": s.get("deliveries", 0),
                "earnings": round(s.get("earnings", 0.0), 2),
            }
    for d in docs:
        st = earnings_map.get(d["driver_id"], {"deliveries": 0, "earnings": 0.0})
        d["deliveries"] = st["deliveries"]
        d["earnings"] = st["earnings"]
        # never leak password hash
        d.pop("password_hash", None)
    return docs


@router.post("/admin/drivers")
async def admin_create_driver(body: DriverIn, admin: dict = Depends(require_super_admin)):
    email = str(body.email).lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "A user with this email already exists")
    if await db.drivers.find_one({"email": email}):
        raise HTTPException(409, "Driver email already exists")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    driver_id = f"drv_{uuid.uuid4().hex[:10]}"
    now = _now()

    # Create the underlying user account (rider role)
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": "rider",
        "auth_provider": "password",
        "picture": None,
        "mobile": body.phone,
        "mobile_verified": False,
        "created_at": now,
    })

    docs = body.docs.model_dump() if body.docs else {}
    driver_doc = {
        "driver_id": driver_id,
        "user_id": user_id,
        "name": body.name,
        "email": email,
        "phone": body.phone,
        "vehicle_type": body.vehicle_type,
        "vehicle_number": body.vehicle_number,
        "store_id": body.store_id,
        "status": "approved",  # Admin-created drivers are approved by default
        "is_online": False,
        "docs": docs,
        "created_at": now,
        "approved_at": now,
        "approved_by": admin["user_id"],
    }
    await db.drivers.insert_one(driver_doc)
    await _audit(admin, "driver.create", driver_id, {"email": email})
    return _public_driver(driver_doc)


@router.get("/admin/drivers/{driver_id}")
async def admin_get_driver(driver_id: str, _: dict = Depends(require_staff)):
    d = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Driver not found")
    d.pop("password_hash", None)

    # Latest assigned orders
    orders = await db.orders.find(
        {"driver_id": driver_id},
        {"_id": 0, "order_id": 1, "total": 1, "status": 1, "created_at": 1, "delivery_fee": 1, "address": 1},
    ).sort("created_at", -1).to_list(50)

    # Earnings summary
    earnings = {"deliveries": 0, "earnings": 0.0}
    async for s in db.orders.aggregate([
        {"$match": {"driver_id": driver_id, "status": "delivered"}},
        {"$group": {
            "_id": None,
            "deliveries": {"$sum": 1},
            "earnings": {"$sum": {"$ifNull": ["$delivery_fee", 25.0]}},
        }},
    ]):
        earnings = {
            "deliveries": s.get("deliveries", 0),
            "earnings": round(s.get("earnings", 0.0), 2),
        }

    return {"driver": d, "orders": orders, "earnings": earnings}


@router.patch("/admin/drivers/{driver_id}")
async def admin_update_driver(
    driver_id: str, body: DriverUpdate, admin: dict = Depends(require_super_admin)
):
    upd = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not upd:
        raise HTTPException(400, "No changes")
    if "docs" in upd and isinstance(upd["docs"], dict):
        pass  # already dict
    res = await db.drivers.update_one({"driver_id": driver_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Driver not found")
    await _audit(admin, "driver.update", driver_id, {k: True for k in upd.keys()})
    return {"ok": True}


@router.post("/admin/drivers/{driver_id}/approve")
async def admin_approve_driver(driver_id: str, admin: dict = Depends(require_super_admin)):
    res = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"status": "approved", "approved_at": _now(), "approved_by": admin["user_id"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Driver not found")
    await _audit(admin, "driver.approve", driver_id)
    return {"ok": True, "status": "approved"}


@router.post("/admin/drivers/{driver_id}/reject")
async def admin_reject_driver(driver_id: str, admin: dict = Depends(require_super_admin)):
    res = await db.drivers.update_one(
        {"driver_id": driver_id}, {"$set": {"status": "rejected"}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Driver not found")
    await _audit(admin, "driver.reject", driver_id)
    return {"ok": True, "status": "rejected"}


@router.post("/admin/drivers/{driver_id}/suspend")
async def admin_suspend_driver(driver_id: str, admin: dict = Depends(require_super_admin)):
    res = await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$set": {"status": "suspended", "is_online": False}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Driver not found")
    await _audit(admin, "driver.suspend", driver_id)
    return {"ok": True, "status": "suspended"}


@router.delete("/admin/drivers/{driver_id}")
async def admin_delete_driver(driver_id: str, admin: dict = Depends(require_super_admin)):
    drv = await db.drivers.find_one({"driver_id": driver_id})
    if not drv:
        raise HTTPException(404, "Driver not found")
    await db.drivers.delete_one({"driver_id": driver_id})
    # Demote/delete user account too (we only delete if they are a pure rider with no orders)
    if drv.get("user_id"):
        await db.users.update_one(
            {"user_id": drv["user_id"]}, {"$set": {"role": "customer"}}
        )
    await _audit(admin, "driver.delete", driver_id)
    return {"ok": True}


# ============================================================
#  ORDER ASSIGNMENT (staff)
# ============================================================
@router.post("/admin/orders/{order_id}/assign")
async def admin_assign_order(
    order_id: str, body: OrderAssignIn, admin: dict = Depends(require_staff)
):
    import random
    drv = await db.drivers.find_one({"driver_id": body.driver_id})
    if not drv:
        raise HTTPException(404, "Driver not found")
    if drv.get("status") != "approved":
        raise HTTPException(400, "Driver not approved")
    # Generate delivery OTP when assigning (moves to out_for_delivery)
    otp = str(random.randint(1000, 9999))
    res = await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "driver_id": body.driver_id,
            "driver_name": drv.get("name"),
            "driver_phone": drv.get("phone"),
            "driver_vehicle": drv.get("vehicle_number") or drv.get("vehicle_type"),
            "assigned_at": _now(),
            "status": "out_for_delivery",
            "delivery_otp": otp,
            "updated_at": _now(),
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Order not found")
    await _audit(admin, "order.assign", order_id, {"driver_id": body.driver_id})
    doc = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    return doc


# ============================================================
#  RIDER SELF-SERVICE
# ============================================================
async def _driver_for_user(user: dict) -> dict:
    drv = await db.drivers.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not drv:
        raise HTTPException(404, "Driver profile not found")
    return drv


@router.get("/rider/me")
async def rider_me(user: dict = Depends(require_rider)):
    drv = await _driver_for_user(user)
    drv.pop("password_hash", None)
    return drv


@router.post("/rider/online")
async def rider_set_online(body: RiderOnlineIn, user: dict = Depends(require_rider)):
    drv = await _driver_for_user(user)
    if drv.get("status") != "approved":
        raise HTTPException(403, "Account not approved yet")
    await db.drivers.update_one(
        {"driver_id": drv["driver_id"]},
        {"$set": {"is_online": body.online, "last_online_at": _now()}},
    )
    return {"ok": True, "online": body.online}


@router.post("/rider/location")
async def rider_ping_location(body: RiderLocationIn, user: dict = Depends(require_rider)):
    drv = await _driver_for_user(user)
    await db.driver_locations.update_one(
        {"driver_id": drv["driver_id"]},
        {"$set": {
            "driver_id": drv["driver_id"],
            "lat": body.lat,
            "lng": body.lng,
            "updated_at": _now(),
        }},
        upsert=True,
    )
    return {"ok": True}


@router.get("/rider/orders")
async def rider_orders(user: dict = Depends(require_rider)):
    drv = await _driver_for_user(user)
    docs = await db.orders.find(
        {"driver_id": drv["driver_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return docs


@router.post("/rider/orders/{order_id}/status")
async def rider_update_order_status(
    order_id: str,
    body: dict,
    user: dict = Depends(require_rider),
):
    drv = await _driver_for_user(user)
    status = (body or {}).get("status")
    if status not in ("out_for_delivery", "delivered"):
        raise HTTPException(400, "Invalid status")

    # Validate delivery OTP when marking as delivered
    if status == "delivered":
        order = await db.orders.find_one(
            {"order_id": order_id, "driver_id": drv["driver_id"]},
            {"_id": 0, "delivery_otp": 1},
        )
        if not order:
            raise HTTPException(404, "Order not found or not assigned to you")
        stored_otp = order.get("delivery_otp")
        if stored_otp:
            rider_otp = str((body or {}).get("otp", "")).strip()
            if not rider_otp:
                raise HTTPException(400, "Delivery OTP is required")
            if rider_otp != stored_otp:
                raise HTTPException(400, "Invalid OTP. Ask the customer for their delivery code.")

    res = await db.orders.update_one(
        {"order_id": order_id, "driver_id": drv["driver_id"]},
        {"$set": {"status": status, "updated_at": _now()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Order not found or not assigned to you")
    return {"ok": True}


@router.get("/rider/earnings")
async def rider_earnings(user: dict = Depends(require_rider)):
    drv = await _driver_for_user(user)
    summary = {"deliveries": 0, "earnings": 0.0}
    async for s in db.orders.aggregate([
        {"$match": {"driver_id": drv["driver_id"], "status": "delivered"}},
        {"$group": {
            "_id": None,
            "deliveries": {"$sum": 1},
            "earnings": {"$sum": {"$ifNull": ["$delivery_fee", 25.0]}},
        }},
    ]):
        summary = {
            "deliveries": s.get("deliveries", 0),
            "earnings": round(s.get("earnings", 0.0), 2),
        }
    # by day (last 14)
    by_day = []
    async for s in db.orders.aggregate([
        {"$match": {"driver_id": drv["driver_id"], "status": "delivered"}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "deliveries": {"$sum": 1},
            "earnings": {"$sum": {"$ifNull": ["$delivery_fee", 25.0]}},
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 14},
    ]):
        by_day.append({
            "date": s["_id"],
            "deliveries": s.get("deliveries", 0),
            "earnings": round(float(s.get("earnings", 0.0)), 2),
        })
    return {"summary": summary, "by_day": by_day}


# ============================================================
#  PUBLIC RIDER APPLICATION
# ============================================================
@router.post("/rider-applications")
async def create_rider_application(body: RiderApplicationIn):
    doc = {
        "application_id": f"rapp_{uuid.uuid4().hex[:10]}",
        "name": body.name,
        "email": str(body.email).lower(),
        "phone": body.phone,
        "city": body.city,
        "vehicle_type": body.vehicle_type,
        "note": body.note,
        "status": "pending",
        "created_at": _now(),
    }
    await db.rider_applications.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/admin/rider-applications")
async def list_rider_applications(_: dict = Depends(require_super_admin)):
    docs = await db.rider_applications.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


# ============================================================
#  PUBLIC: live driver location for customer tracking
# ============================================================
@router.get("/orders/{order_id}/driver-location")
async def get_order_driver_location(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one(
        {"order_id": order_id}, {"_id": 0, "user_id": 1, "driver_id": 1, "driver_name": 1, "driver_phone": 1, "driver_vehicle": 1}
    )
    if not order:
        raise HTTPException(404, "Order not found")
    # Only allow the customer who owns the order OR staff to view
    if order.get("user_id") != user.get("user_id") and user.get("role") not in (
        "admin",
        "super_admin",
        "store_manager",
    ):
        raise HTTPException(403, "Forbidden")
    driver_id = order.get("driver_id")
    if not driver_id:
        return {"assigned": False}
    loc = await db.driver_locations.find_one({"driver_id": driver_id}, {"_id": 0}) or {}
    return {
        "assigned": True,
        "driver": {
            "driver_id": driver_id,
            "name": order.get("driver_name"),
            "phone": order.get("driver_phone"),
            "vehicle": order.get("driver_vehicle"),
        },
        "location": {"lat": loc.get("lat"), "lng": loc.get("lng"), "updated_at": loc.get("updated_at")},
    }
