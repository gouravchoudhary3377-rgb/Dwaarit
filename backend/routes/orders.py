from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import OrderIn, OrderStatusUpdate, ChatMessageIn
from routes.coupons import calculate_discount, _check_eligibility, _normalize_code
from security import get_current_user, require_admin

router = APIRouter(tags=["orders"])

DELIVERY_FEE = 25.0  # INR flat
FREE_DELIVERY_THRESHOLD = 499.0


async def _get_wallet_balance(user_id: str) -> float:
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


async def _wallet_debit(user_id: str, amount: float, note: str, order_id: str) -> None:
    if amount <= 0:
        return
    await db.wallet_txns.insert_one({
        "txn_id": f"wtxn_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "debit",
        "amount": round(amount, 2),
        "note": note,
        "order_id": order_id,
        "created_at": datetime.now(timezone.utc),
    })


@router.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(400, "Order must contain items")
    product_ids = [it.product_id for it in body.items]
    products = await db.products.find({"product_id": {"$in": product_ids}}, {"_id": 0}).to_list(500)
    pmap = {p["product_id"]: p for p in products}
    items = []
    subtotal = 0.0
    for it in body.items:
        p = pmap.get(it.product_id)
        if not p:
            raise HTTPException(400, f"Product {it.product_id} not found")
        line = round(p["price"] * it.quantity, 2)
        subtotal += line
        items.append({
            "product_id": p["product_id"],
            "name": p["name"],
            "image_url": p.get("image_url", ""),
            "unit": p.get("unit", "ea"),
            "price": p["price"],
            "mrp": p.get("mrp"),
            "selling_price": p.get("selling_price"),
            "self_price": p.get("self_price"),
            "quantity": it.quantity,
            "subtotal": line,
        })
    delivery_fee = 0.0 if subtotal >= FREE_DELIVERY_THRESHOLD else DELIVERY_FEE

    # ---- Coupon / Promo code ----
    coupon_code: str | None = None
    coupon_title: str = ""
    discount = 0.0
    if body.coupon_code:
        code = _normalize_code(body.coupon_code)
        coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
        ok, reason = await _check_eligibility(coupon, subtotal, user["user_id"])
        if not ok:
            raise HTTPException(400, reason)
        discount = calculate_discount(coupon, subtotal)
        coupon_code = coupon["code"]
        coupon_title = coupon.get("title", "")

    total_before_wallet = round(subtotal + delivery_fee - discount, 2)
    if total_before_wallet < 0:
        total_before_wallet = 0.0

    wallet_applied = 0.0
    if body.use_wallet:
        bal = await _get_wallet_balance(user["user_id"])
        wallet_applied = round(min(bal, total_before_wallet), 2)

    payable = round(total_before_wallet - wallet_applied, 2)

    order_id = f"ord_{uuid.uuid4().hex[:12]}"
    payment_status = "pending"
    if body.payment_method == "cod":
        payment_status = "cod"
    elif body.payment_method == "wallet" and payable <= 0.01:
        payment_status = "paid"  # wallet fully covers

    doc = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "user_email": user["email"],
        "items": items,
        "subtotal": round(subtotal, 2),
        "delivery_fee": delivery_fee,
        "coupon_code": coupon_code,
        "coupon_title": coupon_title,
        "discount": round(discount, 2),
        "wallet_applied": wallet_applied,
        "payable": payable,
        "total": total_before_wallet,
        "address": body.address.dict(),
        "payment_method": body.payment_method,
        "payment_status": payment_status,
        "notes": body.notes,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.orders.insert_one(doc)
    if coupon_code:
        # Atomic usage increment for global usage_limit accounting
        await db.coupons.update_one(
            {"code": coupon_code}, {"$inc": {"used_count": 1}}
        )
    if wallet_applied > 0:
        await _wallet_debit(user["user_id"], wallet_applied, f"Used on order {order_id}", order_id)
    doc.pop("_id", None)
    return doc


@router.get("/orders")
async def list_my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    doc = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    if doc["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    return doc


@router.post("/orders/{order_id}/reorder")
async def reorder(order_id: str, user: dict = Depends(get_current_user)):
    """Returns the cart items list so frontend can rehydrate cart."""
    doc = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    items = [{"product_id": i["product_id"], "quantity": i["quantity"]} for i in doc["items"]]
    return {"items": items}


@router.get("/orders/{order_id}/invoice")
async def get_invoice(order_id: str, user: dict = Depends(get_current_user)):
    """Returns a JSON 'invoice' that frontend can render to PDF or share."""
    doc = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    if doc["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    return {
        "invoice_no": f"INV-{doc['order_id'].upper()}",
        "order_id": doc["order_id"],
        "date": doc["created_at"],
        "customer": {"name": doc.get("address", {}).get("full_name", ""), "email": doc["user_email"]},
        "address": doc.get("address", {}),
        "items": doc["items"],
        "subtotal": doc.get("subtotal", doc.get("total", 0)),
        "delivery_fee": doc.get("delivery_fee", 0),
        "wallet_applied": doc.get("wallet_applied", 0),
        "payable": doc.get("payable", doc.get("total", 0)),
        "total": doc.get("total", 0),
        "payment_method": doc.get("payment_method"),
        "payment_status": doc.get("payment_status"),
        "status": doc.get("status"),
    }


@router.get("/admin/orders")
async def admin_list_orders(_: dict = Depends(require_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@router.patch("/admin/orders/{order_id}/status")
async def admin_update_order_status(
    order_id: str, body: OrderStatusUpdate, _: dict = Depends(require_admin)
):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")

    update_fields: dict = {"status": body.status, "updated_at": datetime.now(timezone.utc)}

    # Generate delivery OTP when moving to out_for_delivery
    if body.status == "out_for_delivery" and order.get("status") != "out_for_delivery":
        update_fields["delivery_otp"] = str(random.randint(1000, 9999))

    # Validate OTP when marking as delivered
    if body.status == "delivered":
        stored_otp = order.get("delivery_otp")
        if stored_otp:
            if not body.otp:
                raise HTTPException(400, "Delivery OTP is required to mark this order as delivered")
            if body.otp.strip() != stored_otp:
                raise HTTPException(400, "Invalid delivery OTP. Please check the customer's code.")

    await db.orders.update_one({"order_id": order_id}, {"$set": update_fields})
    # Refund to wallet if cancelled (Blinkit-style):
    #   • Always refund any wallet_applied portion.
    #   • Refund prepaid (razorpay) payable on top of that when payment_status == 'paid'.
    #   • For COD orders nothing extra is refunded since cash was never collected,
    #     but wallet_applied (if any) must still come back to the wallet.
    if body.status == "cancelled" and order.get("status") != "cancelled":
        wallet_part = float(order.get("wallet_applied", 0.0))
        prepaid_part = float(order.get("payable", 0.0)) if order.get("payment_status") == "paid" else 0.0
        actual_refund = round(wallet_part + prepaid_part, 2)
        if actual_refund > 0:
            await db.wallet_txns.insert_one({
                "txn_id": f"wtxn_{uuid.uuid4().hex[:12]}",
                "user_id": order["user_id"],
                "type": "refund",
                "amount": actual_refund,
                "note": f"Refund for cancelled order {order_id}",
                "order_id": order_id,
                "created_at": datetime.now(timezone.utc),
            })
    doc = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    return doc



# -------- Order Chat --------
def _is_chat_authorized(order: dict, user: dict) -> bool:
    """Return True if user is allowed to access this order's chat."""
    if user.get("role") in ("admin", "super_admin", "store_manager"):
        return True
    if order.get("user_id") == user["user_id"]:
        return True
    if order.get("driver_id") == user["user_id"]:
        return True
    return False


@router.get("/orders/{order_id}/chat")
async def get_order_chat(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0, "user_id": 1, "driver_id": 1})
    if not order:
        raise HTTPException(404, "Order not found")
    if not _is_chat_authorized(order, user):
        raise HTTPException(403, "Forbidden")
    messages = await db.chat_messages.find(
        {"order_id": order_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return messages


@router.post("/orders/{order_id}/chat")
async def send_chat_message(
    order_id: str, body: ChatMessageIn, user: dict = Depends(get_current_user)
):
    order = await db.orders.find_one(
        {"order_id": order_id},
        {"_id": 0, "user_id": 1, "driver_id": 1, "status": 1},
    )
    if not order:
        raise HTTPException(404, "Order not found")
    if not _is_chat_authorized(order, user):
        raise HTTPException(403, "Forbidden")
    if order.get("status") in ("delivered", "cancelled"):
        raise HTTPException(400, "Chat is only available for active orders")
    msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "order_id": order_id,
        "sender_id": user["user_id"],
        "sender_name": user.get("name", ""),
        "sender_role": user.get("role", "customer"),
        "content": body.content.strip(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.chat_messages.insert_one(msg)
    msg.pop("_id", None)
    return msg
