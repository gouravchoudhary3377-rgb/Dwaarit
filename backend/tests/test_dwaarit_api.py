"""Dwaarit backend API regression tests.

Covers auth (signup/login/me), product CRUD (admin-gated), order placement, and admin order
management. Uses the public EXPO_PUBLIC_BACKEND_URL so we hit the same surface area the
mobile app does.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@dwaarit.com"
ADMIN_PASS = "Admin@123"
CUSTOMER_EMAIL = "demo@dwaarit.com"
CUSTOMER_PASS = "Demo@123"


# ---------------------------------------------------------------- session
@pytest.fixture(scope="session")
def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Accept": "application/json"})
    return s


# ---------------------------------------------------------------- helpers
def _login(session: requests.Session, email: str, password: str) -> dict:
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data


@pytest.fixture(scope="session")
def admin_auth(session) -> dict:
    return _login(session, ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def customer_auth(session) -> dict:
    return _login(session, CUSTOMER_EMAIL, CUSTOMER_PASS)


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------- health
class TestHealth:
    def test_health(self, session):
        r = session.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------------------------------------------------------------- auth
class TestAuth:
    def test_signup_creates_customer(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@dwaarit.com"
        r = session.post(
            f"{API}/auth/signup",
            json={"email": email, "password": "Pass@1234", "name": "TEST User"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "customer"
        assert data["user"]["auth_provider"] == "password"
        assert isinstance(data["token"], str) and len(data["token"]) > 20

        # /me works with the issued token
        me = session.get(f"{API}/auth/me", headers=_hdr(data["token"]))
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_signup_duplicate_email(self, session):
        r = session.post(
            f"{API}/auth/signup",
            json={"email": CUSTOMER_EMAIL, "password": "Demo@123", "name": "x"},
        )
        assert r.status_code == 409

    def test_login_admin_role(self, session):
        data = _login(session, ADMIN_EMAIL, ADMIN_PASS)
        assert data["user"]["role"] == "admin"

    def test_login_customer_role(self, session):
        data = _login(session, CUSTOMER_EMAIL, CUSTOMER_PASS)
        assert data["user"]["role"] == "customer"

    def test_login_wrong_password(self, session):
        r = session.post(
            f"{API}/auth/login",
            json={"email": CUSTOMER_EMAIL, "password": "wrong-pass"},
        )
        assert r.status_code == 401

    def test_me_requires_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------------------------------------------------------- products
class TestProducts:
    def test_list_products_public(self, session):
        r = session.get(f"{API}/products")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) > 0
        first = items[0]
        for k in ("product_id", "name", "price", "category"):
            assert k in first

    def test_list_categories(self, session):
        r = session.get(f"{API}/products/categories")
        assert r.status_code == 200
        cats = r.json().get("categories")
        assert isinstance(cats, list) and len(cats) > 0

    def test_filter_by_category(self, session):
        r = session.get(f"{API}/products", params={"category": "Fruits"})
        assert r.status_code == 200
        items = r.json()
        assert all(it["category"] == "Fruits" for it in items)

    def test_search_query(self, session):
        r = session.get(f"{API}/products", params={"q": "milk"})
        assert r.status_code == 200
        items = r.json()
        assert any("milk" in it["name"].lower() for it in items)

    def test_get_product_by_id(self, session):
        all_p = session.get(f"{API}/products").json()
        pid = all_p[0]["product_id"]
        r = session.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        assert r.json()["product_id"] == pid

    def test_get_product_404(self, session):
        r = session.get(f"{API}/products/prod_does_not_exist")
        assert r.status_code == 404


# ---------------------------------------------------------------- admin products
class TestAdminProductCRUD:
    created_id: str | None = None

    def test_non_admin_cannot_create(self, session, customer_auth):
        r = session.post(
            f"{API}/admin/products",
            headers=_hdr(customer_auth["token"]),
            json={"name": "TEST forbid", "price": 1.0, "category": "Fruits"},
        )
        assert r.status_code == 403

    def test_unauthenticated_cannot_create(self, session):
        r = session.post(
            f"{API}/admin/products",
            json={"name": "TEST nope", "price": 1.0, "category": "Fruits"},
        )
        assert r.status_code == 401

    def test_admin_create_get_update_delete(self, session, admin_auth):
        # Create
        payload = {
            "name": f"TEST Mango {uuid.uuid4().hex[:6]}",
            "description": "test",
            "price": 9.99,
            "unit": "kg",
            "category": "Fruits",
            "image_url": "",
            "stock": 25,
        }
        cr = session.post(f"{API}/admin/products", headers=_hdr(admin_auth["token"]), json=payload)
        assert cr.status_code == 200, cr.text
        created = cr.json()
        pid = created["product_id"]
        assert created["name"] == payload["name"]
        assert created["price"] == payload["price"]

        # Verify persistence via public GET
        g = session.get(f"{API}/products/{pid}")
        assert g.status_code == 200
        assert g.json()["stock"] == 25

        # Patch
        u = session.patch(
            f"{API}/admin/products/{pid}",
            headers=_hdr(admin_auth["token"]),
            json={"price": 12.5, "stock": 50},
        )
        assert u.status_code == 200, u.text
        assert u.json()["price"] == 12.5
        assert u.json()["stock"] == 50

        # Non-admin cannot delete
        d_bad = session.delete(
            f"{API}/admin/products/{pid}",
            headers=_hdr(_login(session, CUSTOMER_EMAIL, CUSTOMER_PASS)["token"]),
        )
        assert d_bad.status_code == 403

        # Admin delete
        d = session.delete(f"{API}/admin/products/{pid}", headers=_hdr(admin_auth["token"]))
        assert d.status_code == 200
        # Confirm gone
        gone = session.get(f"{API}/products/{pid}")
        assert gone.status_code == 404


# ---------------------------------------------------------------- orders
class TestOrders:
    order_id: str | None = None

    def test_customer_create_order(self, session, customer_auth):
        products = session.get(f"{API}/products").json()
        assert len(products) >= 2
        items = [
            {"product_id": products[0]["product_id"], "quantity": 2},
            {"product_id": products[1]["product_id"], "quantity": 1},
        ]
        expected_subtotal = round(products[0]["price"] * 2 + products[1]["price"] * 1, 2)
        # Phase 3 introduced a flat ₹25 delivery fee for orders under ₹499.
        expected_delivery = 0.0 if expected_subtotal >= 499.0 else 25.0
        expected_total = round(expected_subtotal + expected_delivery, 2)
        body = {
            "items": items,
            "address": {
                "full_name": "TEST Buyer",
                "phone": "5551234567",
                "line1": "1 Test St",
                "line2": "",
                "city": "Testville",
                "pincode": "12345",
            },
            "payment_method": "cod",
            "notes": "TEST order",
        }
        r = session.post(f"{API}/orders", headers=_hdr(customer_auth["token"]), json=body)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "pending"
        assert order["payment_method"] == "cod"
        assert order["subtotal"] == expected_subtotal
        assert order["delivery_fee"] == expected_delivery
        assert order["total"] == expected_total
        assert len(order["items"]) == 2
        TestOrders.order_id = order["order_id"]

    def test_create_order_unauth(self, session):
        r = session.post(
            f"{API}/orders",
            json={"items": [], "address": {"full_name": "x", "phone": "x", "line1": "x", "city": "x", "pincode": "x"}},
        )
        assert r.status_code == 401

    def test_list_my_orders_includes_created(self, session, customer_auth):
        r = session.get(f"{API}/orders", headers=_hdr(customer_auth["token"]))
        assert r.status_code == 200
        ids = [o["order_id"] for o in r.json()]
        assert TestOrders.order_id in ids

    def test_customer_cannot_use_admin_orders(self, session, customer_auth):
        r = session.get(f"{API}/admin/orders", headers=_hdr(customer_auth["token"]))
        assert r.status_code == 403

    def test_admin_list_all_orders(self, session, admin_auth):
        r = session.get(f"{API}/admin/orders", headers=_hdr(admin_auth["token"]))
        assert r.status_code == 200
        orders = r.json()
        assert any(o["order_id"] == TestOrders.order_id for o in orders)

    def test_non_admin_cannot_change_status(self, session, customer_auth):
        r = session.patch(
            f"{API}/admin/orders/{TestOrders.order_id}/status",
            headers=_hdr(customer_auth["token"]),
            json={"status": "accepted"},
        )
        assert r.status_code == 403

    def test_admin_status_transitions(self, session, admin_auth):
        for status in ("accepted", "out_for_delivery", "delivered"):
            r = session.patch(
                f"{API}/admin/orders/{TestOrders.order_id}/status",
                headers=_hdr(admin_auth["token"]),
                json={"status": status},
            )
            assert r.status_code == 200, r.text
            assert r.json()["status"] == status

    def test_get_order_by_id_owner_ok(self, session, customer_auth):
        r = session.get(
            f"{API}/orders/{TestOrders.order_id}",
            headers=_hdr(customer_auth["token"]),
        )
        assert r.status_code == 200
        assert r.json()["order_id"] == TestOrders.order_id

    def test_admin_status_404(self, session, admin_auth):
        r = session.patch(
            f"{API}/admin/orders/ord_does_not_exist/status",
            headers=_hdr(admin_auth["token"]),
            json={"status": "delivered"},
        )
        assert r.status_code == 404
