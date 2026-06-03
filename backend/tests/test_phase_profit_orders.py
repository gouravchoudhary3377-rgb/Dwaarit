"""
Tests for Phase: Profit Dashboard, Order price snapshots, Profile wishlist removal, Cart pricing.
Covers:
- GET /api/admin/dashboard profit fields (today/week/month/lifetime, top_profitable, profit_categories)
- POST /api/orders stores selling_price, self_price, mrp in items
- Admin order list includes price snapshot fields
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


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Accept": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session) -> str:
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    body = r.json()
    # Accept admin or super_admin roles
    assert body["user"]["role"] in ("admin", "super_admin"), f"Expected admin role, got: {body['user']['role']}"
    return body["token"]


@pytest.fixture(scope="module")
def customer_token(session) -> str:
    r = session.post(f"{API}/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASS})
    assert r.status_code == 200, f"Customer login failed: {r.text}"
    return r.json()["token"]


# ---- Admin Dashboard Profit Analytics ----
class TestAdminDashboardProfit:
    """Tests for profit fields in GET /api/admin/dashboard"""

    def test_dashboard_returns_200(self, session, admin_token):
        """Admin dashboard endpoint returns 200"""
        r = session.get(f"{API}/admin/dashboard", headers=_hdr(admin_token))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        print("PASS: dashboard returns 200")

    def test_dashboard_has_profit_object(self, session, admin_token):
        """Dashboard response contains 'profit' key"""
        r = session.get(f"{API}/admin/dashboard", headers=_hdr(admin_token))
        data = r.json()
        assert "profit" in data, f"Missing 'profit' key. Keys: {list(data.keys())}"
        print("PASS: 'profit' key present in dashboard response")

    def test_profit_has_required_fields(self, session, admin_token):
        """Profit object has today, week, month, lifetime fields"""
        r = session.get(f"{API}/admin/dashboard", headers=_hdr(admin_token))
        profit = r.json()["profit"]
        for field in ["today", "week", "month", "lifetime"]:
            assert field in profit, f"Missing profit.{field}"
            assert isinstance(profit[field], (int, float)), f"profit.{field} should be numeric"
        print(f"PASS: profit fields: today={profit['today']}, week={profit['week']}, month={profit['month']}, lifetime={profit['lifetime']}")

    def test_dashboard_has_top_profitable(self, session, admin_token):
        """Dashboard response contains 'top_profitable' list"""
        r = session.get(f"{API}/admin/dashboard", headers=_hdr(admin_token))
        data = r.json()
        assert "top_profitable" in data, f"Missing 'top_profitable'. Keys: {list(data.keys())}"
        assert isinstance(data["top_profitable"], list), "top_profitable should be a list"
        print(f"PASS: top_profitable is a list with {len(data['top_profitable'])} items")

    def test_dashboard_has_profit_categories(self, session, admin_token):
        """Dashboard response contains 'profit_categories' list"""
        r = session.get(f"{API}/admin/dashboard", headers=_hdr(admin_token))
        data = r.json()
        assert "profit_categories" in data, f"Missing 'profit_categories'. Keys: {list(data.keys())}"
        assert isinstance(data["profit_categories"], list), "profit_categories should be a list"
        print(f"PASS: profit_categories is a list with {len(data['profit_categories'])} items")

    def test_top_profitable_item_structure(self, session, admin_token):
        """If top_profitable has items, each should have product_id, name, qty, profit"""
        r = session.get(f"{API}/admin/dashboard", headers=_hdr(admin_token))
        top = r.json().get("top_profitable", [])
        if not top:
            print("SKIP: top_profitable is empty (no delivered orders with price snapshots yet)")
            return
        item = top[0]
        for field in ["product_id", "name", "qty", "profit"]:
            assert field in item, f"top_profitable item missing '{field}': {item}"
        print(f"PASS: top_profitable[0] = {item}")

    def test_profit_categories_item_structure(self, session, admin_token):
        """If profit_categories has items, each should have category, profit"""
        r = session.get(f"{API}/admin/dashboard", headers=_hdr(admin_token))
        cats = r.json().get("profit_categories", [])
        if not cats:
            print("SKIP: profit_categories is empty (no delivered orders with price snapshots yet)")
            return
        cat = cats[0]
        for field in ["category", "profit"]:
            assert field in cat, f"profit_categories item missing '{field}': {cat}"
        print(f"PASS: profit_categories[0] = {cat}")

    def test_dashboard_not_accessible_without_auth(self, session):
        """Dashboard endpoint requires authentication"""
        r = session.get(f"{API}/admin/dashboard")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"
        print(f"PASS: unauthenticated request rejected with {r.status_code}")


# ---- POST /orders price snapshot ----
class TestOrderPriceSnapshot:
    """Tests that POST /api/orders snapshots selling_price, self_price, mrp in order items"""

    @pytest.fixture(scope="class")
    def product_with_pricing(self, session, admin_token):
        """Get a product that has selling_price, self_price, mrp fields"""
        r = session.get(f"{API}/products", headers=_hdr(admin_token))
        assert r.status_code == 200
        products = r.json()
        # Find a product with selling_price
        for p in products:
            if p.get("selling_price") is not None:
                print(f"Found product with selling_price: {p['product_id']} - {p['name']}")
                return p
        # If none found, return first product (may have null selling_price)
        if products:
            print(f"WARNING: No product with selling_price found, using first: {products[0]['product_id']}")
            return products[0]
        pytest.skip("No products available")

    @pytest.fixture(scope="class")
    def created_order(self, session, customer_token, product_with_pricing):
        """Create a test order and return it"""
        payload = {
            "items": [{"product_id": product_with_pricing["product_id"], "quantity": 1}],
            "address": {
                "full_name": "TEST_Profit Tester",
                "phone": "9876543210",
                "line1": "123 Test Street",
                "line2": "",
                "city": "Pathankot",
                "state": "Punjab",
                "pincode": "145001",
            },
            "payment_method": "cod",
            "use_wallet": False,
        }
        r = session.post(f"{API}/orders", json=payload, headers=_hdr(customer_token))
        assert r.status_code == 200, f"Order creation failed: {r.text}"
        order = r.json()
        print(f"Created order: {order['order_id']}")
        return order

    def test_order_created_successfully(self, created_order):
        """Order is created with status 200"""
        assert "order_id" in created_order
        assert "items" in created_order
        print(f"PASS: Order {created_order['order_id']} created")

    def test_order_items_have_selling_price_field(self, created_order, product_with_pricing):
        """Order items include selling_price field (can be null if product doesn't have it)"""
        items = created_order["items"]
        assert len(items) > 0, "No items in order"
        item = items[0]
        # The key must exist even if value is None
        assert "selling_price" in item, f"'selling_price' key missing from order item: {list(item.keys())}"
        print(f"PASS: selling_price field present in order item: {item.get('selling_price')}")

    def test_order_items_have_self_price_field(self, created_order):
        """Order items include self_price field (can be null if product doesn't have it)"""
        item = created_order["items"][0]
        assert "self_price" in item, f"'self_price' key missing from order item: {list(item.keys())}"
        print(f"PASS: self_price field present in order item: {item.get('self_price')}")

    def test_order_items_have_mrp_field(self, created_order):
        """Order items include mrp field (can be null if product doesn't have it)"""
        item = created_order["items"][0]
        assert "mrp" in item, f"'mrp' key missing from order item: {list(item.keys())}"
        print(f"PASS: mrp field present in order item: {item.get('mrp')}")

    def test_order_item_selling_price_matches_product(self, created_order, product_with_pricing):
        """Order item selling_price matches product's selling_price"""
        item = created_order["items"][0]
        expected = product_with_pricing.get("selling_price")
        actual = item.get("selling_price")
        assert actual == expected, f"selling_price mismatch: expected {expected}, got {actual}"
        print(f"PASS: selling_price snapshot correct: {actual}")

    def test_order_item_self_price_matches_product(self, created_order, product_with_pricing):
        """Order item self_price matches product's self_price"""
        item = created_order["items"][0]
        expected = product_with_pricing.get("self_price")
        actual = item.get("self_price")
        assert actual == expected, f"self_price mismatch: expected {expected}, got {actual}"
        print(f"PASS: self_price snapshot correct: {actual}")

    def test_order_item_mrp_matches_product(self, created_order, product_with_pricing):
        """Order item mrp matches product's mrp"""
        item = created_order["items"][0]
        expected = product_with_pricing.get("mrp")
        actual = item.get("mrp")
        assert actual == expected, f"mrp mismatch: expected {expected}, got {actual}"
        print(f"PASS: mrp snapshot correct: {actual}")


# ---- Admin Orders list: price fields ----
class TestAdminOrdersListPriceFields:
    """Test that admin orders endpoint returns orders with selling_price/self_price/mrp in items"""

    def test_admin_orders_list_returns_200(self, session, admin_token):
        """GET /api/admin/orders returns 200"""
        r = session.get(f"{API}/admin/orders", headers=_hdr(admin_token))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        print(f"PASS: admin/orders returns 200, {len(r.json())} orders found")

    def test_admin_orders_items_have_price_snapshot_fields(self, session, admin_token):
        """At least one order with items should have selling_price field in items"""
        r = session.get(f"{API}/admin/orders", headers=_hdr(admin_token))
        orders = r.json()
        # Find an order with items
        for order in orders:
            if order.get("items"):
                item = order["items"][0]
                assert "selling_price" in item, f"selling_price missing from admin order item: {list(item.keys())}"
                assert "self_price" in item, f"self_price missing from admin order item: {list(item.keys())}"
                assert "mrp" in item, f"mrp missing from admin order item: {list(item.keys())}"
                print(f"PASS: Order {order['order_id']} items have selling_price/self_price/mrp fields")
                return
        print("SKIP: No orders with items found to verify price fields")
