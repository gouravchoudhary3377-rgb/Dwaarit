from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import Product, ProductIn, ProductUpdate
from security import require_admin

router = APIRouter(tags=["products"])


@router.get("/products", response_model=List[Product])
async def list_products(category: Optional[str] = None, q: Optional[str] = None):
    query: dict = {}
    if category and category.lower() != "all":
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.products.find(query, {"_id": 0}).to_list(500)
    return [Product(**d) for d in docs]


@router.get("/products/categories")
async def list_product_categories():
    cats = await db.products.distinct("category")
    return {"categories": sorted(cats)}


@router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    doc = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Product not found")
    return Product(**doc)


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
