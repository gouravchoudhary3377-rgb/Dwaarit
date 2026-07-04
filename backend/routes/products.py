from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from models import Product, ProductIn, ProductUpdate
from security import require_admin

router = APIRouter(tags=["products"])


def _merge_inventory(product: dict, inv: Optional[dict]) -> dict:
    """Overlay store-specific inventory fields onto a product document."""
    out = dict(product)
    if inv:
        # Override price fields with store-level values when present
        if inv.get("selling_price") is not None:
            out["selling_price"] = inv["selling_price"]
            out["price"] = inv["selling_price"]
        if inv.get("mrp") is not None:
            out["mrp"] = inv["mrp"]
        # Recompute discount percent
        try:
            sp = out.get("selling_price") or out.get("price")
            m = out.get("mrp")
            if sp and m and m > sp:
                out["discount_percent"] = int(round((1 - sp / m) * 100))
        except Exception:
            pass
        out["store_qty"] = inv.get("qty", 0)
        out["is_available"] = inv.get("is_available", True)
        out["is_out_of_stock"] = inv.get("qty", 0) == 0 or not inv.get("is_available", True)
        out["low_stock_threshold"] = inv.get("low_stock_threshold", 5)
        out["is_low_stock"] = 0 < inv.get("qty", 0) <= inv.get("low_stock_threshold", 5)
    else:
        # No inventory record for this store — treat as unavailable
        out["store_qty"] = 0
        out["is_available"] = False
        out["is_out_of_stock"] = True
        out["is_low_stock"] = False
    return out


@router.get("/products")
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    store_id: Optional[str] = Query(default=None),
):
    query: dict = {}
    if category and category.lower() != "all":
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.products.find(query, {"_id": 0}).to_list(500)

    if not store_id:
        # No store context — return catalog products as-is (backward compat)
        return docs

    # Fetch store inventory for all found products in one query
    product_ids = [d["product_id"] for d in docs]
    inv_docs = await db.store_inventory.find(
        {"store_id": store_id, "product_id": {"$in": product_ids}},
        {"_id": 0},
    ).to_list(500)
    inv_map = {i["product_id"]: i for i in inv_docs}

    result = [_merge_inventory(doc, inv_map.get(doc["product_id"])) for doc in docs]

    # Sort: available first, then out-of-stock
    result.sort(key=lambda p: (p.get("is_out_of_stock", False), p.get("name", "")))
    return result


@router.get("/products/categories")
async def list_product_categories(store_id: Optional[str] = Query(default=None)):
    if store_id:
        # Only return categories that have at least one available product in this store
        available_pids = await db.store_inventory.distinct(
            "product_id",
            {"store_id": store_id, "is_available": True, "qty": {"$gt": 0}},
        )
        if available_pids:
            cats = await db.products.distinct("category", {"product_id": {"$in": available_pids}})
        else:
            cats = await db.products.distinct("category")
    else:
        cats = await db.products.distinct("category")
    return {"categories": sorted(cats)}


@router.get("/products/{product_id}")
async def get_product(product_id: str, store_id: Optional[str] = Query(default=None)):
    doc = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Product not found")
    if store_id:
        inv = await db.store_inventory.find_one(
            {"store_id": store_id, "product_id": product_id}, {"_id": 0}
        )
        return _merge_inventory(doc, inv)
    return doc


@router.post("/admin/products", response_model=Product)
async def admin_create_product(body: ProductIn, _: dict = Depends(require_admin)):
    data = body.dict()
    # Keep `price` and `selling_price` in sync for legacy/back-compat
    if data.get("selling_price") is None and data.get("price") is not None:
        data["selling_price"] = data["price"]
    if data.get("selling_price") is not None:
        data["price"] = data["selling_price"]
    if data.get("mrp") is None:
        data["mrp"] = data.get("price")
    # Auto-compute discount percent if MRP > selling price
    try:
        if data.get("mrp") and data.get("selling_price") and data["mrp"] > data["selling_price"]:
            data["discount_percent"] = int(round((1 - data["selling_price"] / data["mrp"]) * 100))
    except Exception:
        pass
    p = Product(**data)
    await db.products.insert_one(p.dict())
    return p


@router.patch("/admin/products/{product_id}", response_model=Product)
async def admin_update_product(
    product_id: str, body: ProductUpdate, _: dict = Depends(require_admin)
):
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if not upd:
        raise HTTPException(400, "No fields to update")
    # Sync price <-> selling_price
    if "selling_price" in upd:
        upd["price"] = upd["selling_price"]
    elif "price" in upd:
        upd["selling_price"] = upd["price"]
    # Auto-discount
    try:
        if upd.get("mrp") and upd.get("selling_price") and upd["mrp"] > upd["selling_price"]:
            upd["discount_percent"] = int(round((1 - upd["selling_price"] / upd["mrp"]) * 100))
    except Exception:
        pass
    res = await db.products.update_one({"product_id": product_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Product not found")
    doc = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    return Product(**doc)


@router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, _: dict = Depends(require_admin)):
    res = await db.products.delete_one({"product_id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"ok": True}
