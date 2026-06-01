from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from config import RAZORPAY_ENABLED, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
from database import db
from models import RazorpayCreateOrderIn, RazorpayVerifyIn, SavePaymentMethodIn
from security import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/config")
async def payments_config():
    return {
        "razorpay_enabled": RAZORPAY_ENABLED,
        "razorpay_key_id": RAZORPAY_KEY_ID if RAZORPAY_ENABLED else "",
        "currency": "INR",
    }


@router.post("/razorpay/create-order")
async def create_razorpay_order(
    body: RazorpayCreateOrderIn, user: dict = Depends(get_current_user)
):
    """Creates a Razorpay order. Falls back to mock mode when keys are unset."""
    amount_paise = int(round(body.amount * 100))
    if RAZORPAY_ENABLED:
        try:
            import razorpay  # type: ignore
            cli = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            rp_order = cli.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": body.order_id or f"rcpt_{uuid.uuid4().hex[:10]}",
                "notes": {"user_id": user["user_id"]},
            })
            return {
                "mode": "live",
                "key_id": RAZORPAY_KEY_ID,
                "razorpay_order_id": rp_order["id"],
                "amount": amount_paise,
                "currency": "INR",
            }
        except Exception as e:
            raise HTTPException(502, f"Razorpay error: {e}")
    # Mock mode
    return {
        "mode": "mock",
        "key_id": "",
        "razorpay_order_id": f"order_mock_{uuid.uuid4().hex[:14]}",
        "amount": amount_paise,
        "currency": "INR",
    }


@router.post("/razorpay/verify")
async def verify_razorpay_payment(
    body: RazorpayVerifyIn, user: dict = Depends(get_current_user)
):
    verified = False
    if RAZORPAY_ENABLED:
        msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
        expected = hmac.new(
            RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256
        ).hexdigest()
        verified = hmac.compare_digest(expected, body.razorpay_signature)
        if not verified:
            raise HTTPException(400, "Signature verification failed")
    else:
        # mock mode accepts any signature
        verified = True

    if body.order_id:
        await db.orders.update_one(
            {"order_id": body.order_id, "user_id": user["user_id"]},
            {"$set": {
                "payment_status": "paid",
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_order_id": body.razorpay_order_id,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
    return {"ok": True, "verified": verified}


# ---------- Saved Payment Methods (tokenised display only) ----------
@router.get("/methods")
async def list_methods(user: dict = Depends(get_current_user)):
    docs = await db.payment_methods.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return docs


@router.post("/methods")
async def add_method(body: SavePaymentMethodIn, user: dict = Depends(get_current_user)):
    method_id = f"pm_{uuid.uuid4().hex[:12]}"
    doc = {
        "method_id": method_id,
        "user_id": user["user_id"],
        "kind": body.kind,
        "label": body.label or (body.kind.upper()),
        "last4": body.last4,
        "brand": body.brand,
        "vpa": body.vpa,
        "token": body.token or f"tok_{uuid.uuid4().hex[:16]}",
        "created_at": datetime.now(timezone.utc),
    }
    await db.payment_methods.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/methods/{method_id}")
async def delete_method(method_id: str, user: dict = Depends(get_current_user)):
    res = await db.payment_methods.delete_one(
        {"method_id": method_id, "user_id": user["user_id"]}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Payment method not found")
    return {"ok": True}


_ = List  # type-checker noqa
