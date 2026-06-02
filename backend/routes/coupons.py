"""Coupon / Promo Code routes (Blinkit-style).

Public endpoints:
  GET  /coupons              -> list currently active coupons (for storefront)
  POST /coupons/validate     -> validate code against a subtotal & return discount

Admin endpoints (require admin/super_admin):
  GET    /admin/coupons              -> list all coupons (active + inactive)
  POST   /admin/coupons              -> create coupon
  PATCH  /admin/coupons/{code}       -> update coupon
  DELETE /admin/coupons/{code}       -> delete coupon
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import CouponIn, CouponUpdate, CouponValidateIn
from security import get_current_user, require_admin

router = APIRouter(tags=["coupons"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_code(code: str) -> str:
    return (code or "").strip().upper()


def _public_coupon(doc: dict) -> dict:
    """Strip internal fields for public/storefront consumption."""
    return {
        "code": doc.get("code"),
        "title": doc.get("title", ""),
        "description": doc.get("description", ""),
        "discount_type": doc.get("discount_type", "percent"),
        "value": doc.get("value", 0),
        "min_order_value": doc.get("min_order_value", 0),
        "max_discount": doc.get("max_discount"),
        "expires_at": doc.get("expires_at"),
    }


def calculate_discount(coupon: dict, subtotal: float) -> float:
    """Return the rupee discount this coupon applies to `subtotal`.

    Caller is responsible for checking eligibility (active/expired/min order).
    Always rounds to 2 decimals and never exceeds subtotal.
    """
    if subtotal <= 0:
        return 0.0
    d_type = coupon.get("discount_type", "percent")
    value = float(coupon.get("value", 0))
    if d_type == "flat":
        disc = value
    else:  # percent
        disc = (subtotal * value) / 100.0
        cap = coupon.get("max_discount")
        if cap is not None:
            disc = min(disc, float(cap))
    disc = min(disc, subtotal)
    return round(max(0.0, disc), 2)


async def _check_eligibility(
    coupon: dict, subtotal: float, user_id: Optional[str]
) -> tuple[bool, str]:
    if not coupon:
        return False, "Invalid coupon code"
    if not coupon.get("active", True):
        return False, "This coupon is no longer active"
    expires_at = coupon.get("expires_at")
    if expires_at:
        # mongo stores tz-aware datetimes
        if isinstance(expires_at, datetime):
            exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
            if exp < _now():
                return False, "This coupon has expired"
    min_val = float(coupon.get("min_order_value") or 0)
    if subtotal < min_val:
        return False, f"Add items worth \u20b9{min_val:.0f} or more to use this coupon"
    usage_limit = coupon.get("usage_limit")
    if usage_limit is not None and int(coupon.get("used_count", 0)) >= int(usage_limit):
        return False, "This coupon has reached its usage limit"
    per_user_limit = coupon.get("per_user_limit")
    if user_id and per_user_limit is not None:
        used = await db.orders.count_documents({
            "user_id": user_id,
            "coupon_code": coupon["code"],
            "status": {"$ne": "cancelled"},
        })
        if used >= int(per_user_limit):
            return False, "You have already used this coupon"
    return True, ""


# ---------------- Public ----------------

@router.get("/coupons")
async def list_active_coupons():
    cur = db.coupons.find(
        {"active": True},
        {"_id": 0, "used_count": 0, "usage_limit": 0, "per_user_limit": 0},
    ).sort("created_at", -1)
    items = []
    async for d in cur:
        # filter out expired ones for storefront
        exp = d.get("expires_at")
        if isinstance(exp, datetime):
            exp_aware = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
            if exp_aware < _now():
                continue
        items.append(_public_coupon(d))
    return items


@router.post("/coupons/validate")
async def validate_coupon(
    body: CouponValidateIn, user: dict = Depends(get_current_user)
):
    code = _normalize_code(body.code)
    coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
    ok, reason = await _check_eligibility(coupon, body.subtotal, user["user_id"])
    if not ok:
        raise HTTPException(400, reason)
    discount = calculate_discount(coupon, body.subtotal)
    return {
        "valid": True,
        "code": coupon["code"],
        "title": coupon.get("title", ""),
        "description": coupon.get("description", ""),
        "discount": discount,
        "discount_type": coupon.get("discount_type"),
        "value": coupon.get("value"),
        "max_discount": coupon.get("max_discount"),
        "new_subtotal": round(body.subtotal - discount, 2),
    }


# ---------------- Admin ----------------

@router.get("/admin/coupons")
async def admin_list_coupons(_: dict = Depends(require_admin)):
    cur = db.coupons.find({}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(500)


@router.post("/admin/coupons")
async def admin_create_coupon(body: CouponIn, _: dict = Depends(require_admin)):
    code = _normalize_code(body.code)
    if not code:
        raise HTTPException(400, "Coupon code is required")
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(400, "A coupon with this code already exists")
    if body.discount_type == "percent" and body.value > 100:
        raise HTTPException(400, "Percent value cannot exceed 100")
    doc = body.dict()
    doc["code"] = code
    doc["used_count"] = 0
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/admin/coupons/{code}")
async def admin_update_coupon(
    code: str, body: CouponUpdate, _: dict = Depends(require_admin)
):
    code = _normalize_code(code)
    coupon = await db.coupons.find_one({"code": code})
    if not coupon:
        raise HTTPException(404, "Coupon not found")
    updates = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if not updates:
        coupon.pop("_id", None)
        return coupon
    if (
        updates.get("discount_type", coupon.get("discount_type")) == "percent"
        and "value" in updates and updates["value"] > 100
    ):
        raise HTTPException(400, "Percent value cannot exceed 100")
    updates["updated_at"] = _now()
    await db.coupons.update_one({"code": code}, {"$set": updates})
    doc = await db.coupons.find_one({"code": code}, {"_id": 0})
    return doc


@router.delete("/admin/coupons/{code}")
async def admin_delete_coupon(code: str, _: dict = Depends(require_admin)):
    code = _normalize_code(code)
    res = await db.coupons.delete_one({"code": code})
    if res.deleted_count == 0:
        raise HTTPException(404, "Coupon not found")
    return {"ok": True}
