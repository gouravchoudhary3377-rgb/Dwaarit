"""MongoDB client + collection helpers."""
from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import DB_NAME, MONGO_URL

client: AsyncIOMotorClient = AsyncIOMotorClient(MONGO_URL)
db: AsyncIOMotorDatabase = client[DB_NAME]


async def ensure_indexes() -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.products.create_index("product_id", unique=True)
    await db.products.create_index("category")
    await db.categories.create_index("slug", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index("user_id")

    # New collections
    await db.addresses.create_index("address_id", unique=True)
    await db.addresses.create_index("user_id")
    await db.wishlist.create_index([("user_id", 1), ("product_id", 1)], unique=True)
    await db.wallet_txns.create_index("txn_id", unique=True)
    await db.wallet_txns.create_index([("user_id", 1), ("created_at", -1)])
    await db.payment_methods.create_index("method_id", unique=True)
    await db.payment_methods.create_index("user_id")
    await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.support_tickets.create_index("ticket_id", unique=True)
    await db.support_tickets.create_index("user_id")
    await db.support_messages.create_index([("ticket_id", 1), ("created_at", 1)])
