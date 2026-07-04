"""Store Inventory — public + admin endpoints.

Collections:
  stores          — existing, extended with radius/hours
  store_inventory — (store_id, product_id) inventory records
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from models import StoreInventoryIn, StoreInventoryUpdate
from security import get_current_user, require_admin

router = APIRouter(tags=["inventory"])

# ─── Helpers ────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two (lat, lng) points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Public ─────────────────────────────────────────────────────────────────

@router.get("/stores")
async def list_active_stores():
    """Return all active stores (public)."""
    docs = await db.stores.find({"is_active": True}, {"_id": 0}).to_list(200)
    return docs


@router.get("/stores/nearest")
async def nearest_store(
    lat: float = Query(..., description="Customer latitude"),
    lng: float = Query(..., description="Customer longitude"),
):
    """
    Find the nearest active store within its delivery radius.
    Returns 404 with a friendly message if no store serves the location.
    """
    stores = await db.stores.find({"is_active": True}, {"_id": 0}).to_list(500)
    best = None
    best_dist = float("inf")

    for s in stores:
        s_lat = s.get("lat") or s.get("latitude")
        s_lng = s.get("lng") or s.get("longitude")
        if s_lat is None or s_lng is None:
            continue
        dist = _haversine_km(lat, lng, s_lat, s_lng)
        radius = s.get("delivery_radius_km", 5.0)
        if dist <= radius and dist < best_dist:
            best = s
            best_dist = dist

    if not best:
        raise HTTPException(
            404,
            "Sorry, we don't currently deliver to this location. "
            "We're working hard to expand — check back soon!",
        )

    return {**best, "distance_km": round(best_dist, 2)}


# ─── Admin — Inventory CRUD ─────────────────────────────────────────────────

@router.get("/admin/stores/{store_id}/inventory")
async def get_store_inventory(store_id: str, _: dict = Depends(require_admin)):
    """List all inventory records for a store, enriched with product details."""
    store = await db.stores.find_one({"store_id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(404, "Store not found")

    pipeline = [
        {"$match": {"store_id": store_id}},
        {
            "$lookup": {
                "from": "products",
                "localField": "product_id",
                "foreignField": "product_id",
                "as": "product",
            }
        },
        {"$unwind": {"path": "$product", "preserveNullAndEmptyArrays": True}},
        {"$project": {"_id": 0}},
        {"$sort": {"product.category": 1, "product.name": 1}},
    ]
    items = await db.store_inventory.aggregate(pipeline).to_list(2000)
    return {"store": store, "inventory": items, "total": len(items)}


@router.put("/admin/stores/{store_id}/inventory/{product_id}")
async def upsert_inventory(
    store_id: str,
    product_id: str,
    body: StoreInventoryIn,
    admin: dict = Depends(require_admin),
):
    """Create or update a single inventory record for a store + product pair."""
    store = await db.stores.find_one({"store_id": store_id})
    if not store:
        raise HTTPException(404, "Store not found")
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(404, "Product not found")

    now = datetime.now(timezone.utc)
    upd = {
        "store_id": store_id,
        "product_id": product_id,
        "qty": body.qty,
        "selling_price": body.selling_price or product.get("selling_price") or product.get("price"),
        "mrp": body.mrp or product.get("mrp") or product.get("price"),
        "is_available": body.is_available,
        "low_stock_threshold": body.low_stock_threshold,
        "updated_at": now,
    }
    result = await db.store_inventory.update_one(
        {"store_id": store_id, "product_id": product_id},
        {
            "$set": upd,
            "$setOnInsert": {
                "inv_id": f"inv_{uuid.uuid4().hex[:12]}",
                "created_at": now,
            },
        },
        upsert=True,
    )
    doc = await db.store_inventory.find_one(
        {"store_id": store_id, "product_id": product_id}, {"_id": 0}
    )
    return doc


@router.patch("/admin/stores/{store_id}/inventory/{product_id}")
async def patch_inventory(
    store_id: str,
    product_id: str,
    body: StoreInventoryUpdate,
    admin: dict = Depends(require_admin),
):
    """Partially update an inventory record."""
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    upd["updated_at"] = datetime.now(timezone.utc)
    res = await db.store_inventory.update_one(
        {"store_id": store_id, "product_id": product_id}, {"$set": upd}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Inventory record not found")
    doc = await db.store_inventory.find_one(
        {"store_id": store_id, "product_id": product_id}, {"_id": 0}
    )
    return doc


@router.post("/admin/stores/{store_id}/inventory/bulk")
async def bulk_upsert_inventory(
    store_id: str,
    items: list[dict],
    admin: dict = Depends(require_admin),
):
    """Bulk create/update inventory records (list of {product_id, qty, selling_price, ...})."""
    store = await db.stores.find_one({"store_id": store_id})
    if not store:
        raise HTTPException(404, "Store not found")

    now = datetime.now(timezone.utc)
    ops = []
    for item in items:
        pid = item.get("product_id")
        if not pid:
            continue
        product = await db.products.find_one({"product_id": pid}, {"_id": 0})
        if not product:
            continue
        doc = {
            "store_id": store_id,
            "product_id": pid,
            "qty": item.get("qty", 0),
            "selling_price": item.get("selling_price") or product.get("selling_price") or product.get("price"),
            "mrp": item.get("mrp") or product.get("mrp") or product.get("price"),
            "is_available": item.get("is_available", True),
            "low_stock_threshold": item.get("low_stock_threshold", 5),
            "updated_at": now,
        }
        from pymongo import UpdateOne
        ops.append(UpdateOne(
            {"store_id": store_id, "product_id": pid},
            {
                "$set": doc,
                "$setOnInsert": {
                    "inv_id": f"inv_{uuid.uuid4().hex[:12]}",
                    "created_at": now,
                },
            },
            upsert=True,
        ))

    if ops:
        await db.store_inventory.bulk_write(ops)

    count = await db.store_inventory.count_documents({"store_id": store_id})
    return {"ok": True, "processed": len(ops), "total_records": count}


# ─── Reduce inventory after order fulfillment ─────────────────────────────

async def deduct_inventory(store_id: str, items: list[dict]) -> None:
    """
    Decrement qty in store_inventory for each order line item.
    Called after an order is placed or delivered.
    Silently ignores products not tracked in this store.
    """
    if not store_id:
        return
    for item in items:
        pid = item.get("product_id")
        qty = item.get("quantity", 0)
        if pid and qty > 0:
            await db.store_inventory.update_one(
                {"store_id": store_id, "product_id": pid},
                {"$inc": {"qty": -qty}, "$set": {"updated_at": datetime.now(timezone.utc)}},
            )
