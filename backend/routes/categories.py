from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from database import db
from models import Category, CategoryIn
from security import require_admin

router = APIRouter(tags=["categories"])


def slugify(name: str) -> str:
    return "-".join(name.lower().split())


@router.get("/categories", response_model=List[Category])
async def list_categories_full():
    docs = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return [Category(**d) for d in docs]


@router.post("/admin/categories", response_model=Category)
async def admin_create_category(body: CategoryIn, _: dict = Depends(require_admin)):
    slug = slugify(body.name)
    if await db.categories.find_one({"slug": slug}):
        raise HTTPException(409, "Category already exists")
    cat = Category(slug=slug, name=body.name.strip(), icon=body.icon, gallery=body.gallery, is_default=False)
    await db.categories.insert_one(cat.dict())
    return cat


@router.delete("/admin/categories/{slug}")
async def admin_delete_category(slug: str, _: dict = Depends(require_admin)):
    cat = await db.categories.find_one({"slug": slug})
    if not cat:
        raise HTTPException(404, "Category not found")
    if cat.get("is_default"):
        raise HTTPException(400, "Cannot delete a default category")
    in_use = await db.products.count_documents({"category": cat["name"]})
    if in_use > 0:
        raise HTTPException(400, f"Category in use by {in_use} products")
    await db.categories.delete_one({"slug": slug})
    return {"ok": True}
