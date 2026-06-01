"""Dwaarit Grocery Delivery API — modular entrypoint.

All routes are mounted under /api per Kubernetes ingress rules.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import client, ensure_indexes
from routes.addresses import router as addresses_router
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.categories import router as categories_router
from routes.orders import router as orders_router
from routes.payments import router as payments_router
from routes.products import router as products_router
from routes.profile import router as profile_router
from routes.support import router as support_router
from routes.wallet import router as wallet_router
from routes.wishlist import router as wishlist_router
from seed import seed_categories, seed_users_and_products

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s"
)
log = logging.getLogger("dwaarit")

app = FastAPI(title="Dwaarit API")
api = APIRouter(prefix="/api")

# mount feature routers
api.include_router(auth_router)
api.include_router(admin_router)
api.include_router(products_router)
api.include_router(categories_router)
api.include_router(orders_router)
api.include_router(profile_router)
api.include_router(addresses_router)
api.include_router(wishlist_router)
api.include_router(wallet_router)
api.include_router(payments_router)
api.include_router(support_router)


@api.get("/")
async def root():
    return {"app": "Dwaarit API", "status": "ok"}


@api.get("/health")
async def health():
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}


@app.on_event("startup")
async def on_startup():
    await ensure_indexes()
    await seed_users_and_products()
    await seed_categories()
    log.info("Dwaarit API ready.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
