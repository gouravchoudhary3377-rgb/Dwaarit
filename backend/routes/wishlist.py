from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import WishlistAddIn
from security import get_current_user

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("")
async def list_wishlist(user: dict = Depends(get_current_user)):
    items = await db.wishlist.find({"user_id": user["user_id"]}, {"_id": 0}).sort(
        "added_at", -1
    ).to_list(500)
    product_ids = [i["product_id"] for i in items]
    products = await db.products.find(
        {"product_id": {"$in": product_ids}}, {"_id": 0}
    ).to_list(500)
    pmap = {p["product_id"]: p for p in products}
    out = []
    for it in items:
        p = pmap.get(it["product_id"])
        if p:
            out.append({**p, "added_at": it.get("added_at")})
    return out


@router.post("")
async def add_to_wishlist(body: WishlistAddIn, user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"product_id": body.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    await db.wishlist.update_one(
        {"user_id": user["user_id"], "product_id": body.product_id},
        {"$setOnInsert": {
            "user_id": user["user_id"],
            "product_id": body.product_id,
            "added_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"ok": True}


@router.delete("/{product_id}")
async def remove_from_wishlist(product_id: str, user: dict = Depends(get_current_user)):
    res = await db.wishlist.delete_one(
        {"user_id": user["user_id"], "product_id": product_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Not in wishlist")
    return {"ok": True}
