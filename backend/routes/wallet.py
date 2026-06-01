from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from config import RAZORPAY_ENABLED, RAZORPAY_KEY_SECRET
from database import db
from models import WalletAddIn, WalletRazorpayVerifyIn
from security import get_current_user

router = APIRouter(prefix="/wallet", tags=["wallet"])


async def compute_balance(user_id: str) -> float:
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "credits": {"$sum": {"$cond": [{"$in": ["$type", ["credit", "refund", "topup"]]}, "$amount", 0]}},
            "debits": {"$sum": {"$cond": [{"$eq": ["$type", "debit"]}, "$amount", 0]}},
        }},
    ]
    cur = db.wallet_txns.aggregate(pipeline)
    bal = 0.0
    async for d in cur:
        bal = round(float(d.get("credits", 0.0)) - float(d.get("debits", 0.0)), 2)
    return bal


@router.get("")
async def wallet_summary(user: dict = Depends(get_current_user)):
    bal = await compute_balance(user["user_id"])
    txns = await db.wallet_txns.find({"user_id": user["user_id"]}, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(100)
    return {"balance": bal, "transactions": txns}


@router.post("/topup")
async def topup(body: WalletAddIn, user: dict = Depends(get_current_user)):
    """Mock top-up: instantly credits the wallet. In production this would be
    gated by a verified Razorpay payment via /wallet/razorpay/verify."""
    await db.wallet_txns.insert_one({
        "txn_id": f"wtxn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "type": "topup",
        "amount": round(float(body.amount), 2),
        "note": body.note or "Wallet top-up",
        "created_at": datetime.now(timezone.utc),
    })
    bal = await compute_balance(user["user_id"])
    return {"ok": True, "balance": bal}


@router.post("/razorpay/verify")
async def razorpay_topup_verify(
    body: WalletRazorpayVerifyIn, user: dict = Depends(get_current_user)
):
    """Verifies a Razorpay payment used for wallet top-up and credits balance.

    In mock mode (no Razorpay keys configured) accepts any signature.
    """
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
        verified = True

    # Idempotency: skip if this payment already credited
    existing = await db.wallet_txns.find_one(
        {"user_id": user["user_id"], "razorpay_payment_id": body.razorpay_payment_id}
    )
    if existing:
        bal = await compute_balance(user["user_id"])
        return {"ok": True, "balance": bal, "duplicate": True}

    await db.wallet_txns.insert_one({
        "txn_id": f"wtxn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "type": "topup",
        "amount": round(float(body.amount), 2),
        "note": "Wallet top-up via Razorpay",
        "razorpay_order_id": body.razorpay_order_id,
        "razorpay_payment_id": body.razorpay_payment_id,
        "created_at": datetime.now(timezone.utc),
    })
    bal = await compute_balance(user["user_id"])
    return {"ok": True, "balance": bal, "verified": verified}
