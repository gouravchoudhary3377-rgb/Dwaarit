from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import OrderIn, OrderStatusUpdate
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
            "quantity": it.quantity,
            "subtotal": line,
        })
    delivery_fee = 0.0 if subtotal >= FREE_DELIVERY_THRESHOLD else DELIVERY_FEE
    total_before_wallet = round(subtotal + delivery_fee, 2)

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
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
    )
    # Refund to wallet if cancelled
    if body.status == "cancelled" and order.get("status") != "cancelled":
        refund_amt = round(float(order.get("payable", 0.0)) + float(order.get("wallet_applied", 0.0)), 2)
        if refund_amt > 0 and order.get("payment_status") in ("paid", "cod"):
            # Only refund prepaid portion. For COD where nothing was paid, skip cash refund.
            actual_refund = round(float(order.get("wallet_applied", 0.0))
                                  + (float(order.get("payable", 0.0)) if order.get("payment_status") == "paid" else 0.0), 2)
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
