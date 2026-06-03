"""Phase 8.4 — Store Manager portal RBAC + endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://order-analytics-26.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _login(email, pwd):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def manager_token():
    data = _login("manager@dwaarit.com", "Manager@123")
    assert data["user"]["role"] == "store_manager", f"expected store_manager, got {data['user']['role']}"
    return data["token"]


@pytest.fixture(scope="module")
def customer_token():
    data = _login("demo@dwaarit.com", "Demo@123")
    return data["token"]


@pytest.fixture(scope="module")
def admin_token():
    data = _login("admin@dwaarit.com", "Admin@123")
    return data["token"]


@pytest.fixture(scope="module")
def rider_token():
    data = _login("rider@dwaarit.com", "Rider@123")
    return data["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ─── Auth role landings (regression) ────────────────────────────────────────
class TestLoginRoles:
    def test_manager_role(self, manager_token):
        assert manager_token

    def test_customer_role(self, customer_token):
        r = requests.get(f"{API}/auth/me", headers=_h(customer_token))
        assert r.status_code == 200
        assert r.json()["role"] == "customer"

    def test_admin_role(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_h(admin_token))
        assert r.status_code == 200
        assert r.json()["role"] in ("admin", "super_admin")

    def test_rider_role(self, rider_token):
        r = requests.get(f"{API}/auth/me", headers=_h(rider_token))
        assert r.status_code == 200
        assert r.json()["role"] == "rider"


# ─── RBAC enforcement ────────────────────────────────────────────────────────
class TestRBAC:
    def test_dashboard_no_token_returns_401(self):
        r = requests.get(f"{API}/store/dashboard")
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"

    def test_dashboard_customer_returns_403(self, customer_token):
        r = requests.get(f"{API}/store/dashboard", headers=_h(customer_token))
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_dashboard_rider_returns_403(self, rider_token):
        r = requests.get(f"{API}/store/dashboard", headers=_h(rider_token))
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_orders_no_token_returns_401(self):
        r = requests.get(f"{API}/store/orders")
        assert r.status_code == 401

    def test_orders_customer_returns_403(self, customer_token):
        r = requests.get(f"{API}/store/orders", headers=_h(customer_token))
        assert r.status_code == 403


# ─── /store/me ───────────────────────────────────────────────────────────────
class TestStoreMe:
    def test_me_returns_manager_and_store(self, manager_token):
        r = requests.get(f"{API}/store/me", headers=_h(manager_token))
        assert r.status_code == 200
        data = r.json()
        assert "manager" in data and "store" in data
        assert data["manager"]["email"] == "manager@dwaarit.com"
        assert data["manager"]["role"] == "store_manager"
        assert data["store"] is not None, "manager should have a linked store"
        assert "store_id" in data["store"]


# ─── Dashboard ───────────────────────────────────────────────────────────────
class TestDashboard:
    def test_dashboard_shape(self, manager_token):
        r = requests.get(f"{API}/store/dashboard", headers=_h(manager_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("store", "orders", "revenue_today", "drivers", "inventory"):
            assert k in d, f"missing {k} in dashboard payload"
        for k in ("pending", "in_progress", "delivered_today", "delivered_week"):
            assert k in d["orders"], f"missing orders.{k}"
        assert "total" in d["drivers"] and "online" in d["drivers"]
        assert "low_stock" in d["inventory"] and "out_of_stock" in d["inventory"]
        assert isinstance(d["revenue_today"], (int, float))


# ─── Orders list ─────────────────────────────────────────────────────────────
class TestOrders:
    def test_list_orders_returns_list(self, manager_token):
        r = requests.get(f"{API}/store/orders", headers=_h(manager_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_orders_status_filter(self, manager_token):
        r = requests.get(f"{API}/store/orders?status=pending", headers=_h(manager_token))
        assert r.status_code == 200
        data = r.json()
        for o in data:
            assert o.get("status") == "pending"

    def test_get_unknown_order_returns_404(self, manager_token):
        r = requests.get(f"{API}/store/orders/order_does_not_exist", headers=_h(manager_token))
        assert r.status_code == 404


# ─── Drivers ─────────────────────────────────────────────────────────────────
class TestDrivers:
    def test_list_drivers(self, manager_token):
        r = requests.get(f"{API}/store/drivers", headers=_h(manager_token))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# ─── Products ────────────────────────────────────────────────────────────────
class TestProducts:
    def test_list_products(self, manager_token):
        r = requests.get(f"{API}/store/products", headers=_h(manager_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            p = data[0]
            assert "product_id" in p and "stock" in p

    def test_list_products_low_stock(self, manager_token):
        r = requests.get(f"{API}/store/products?low_stock=true", headers=_h(manager_token))
        assert r.status_code == 200
        for p in r.json():
            assert p.get("stock", 0) <= 5


# ─── Assign rider flow (end-to-end smoke if data available) ─────────────────
class TestAssignRider:
    def test_assign_rider_flow(self, manager_token):
        # 1. find a non-delivered order (pending/confirmed)
        r = requests.get(f"{API}/store/orders", headers=_h(manager_token))
        assert r.status_code == 200
        orders = r.json()
        target = next(
            (o for o in orders if o.get("status") in ("pending", "confirmed", "preparing")),
            None,
        )
        if not target:
            pytest.skip("No assignable order present in DB; skipping driver assignment smoke")

        # 2. find an approved driver for this store
        d = requests.get(f"{API}/store/drivers?status=approved", headers=_h(manager_token))
        assert d.status_code == 200
        drivers = d.json()
        if not drivers:
            pytest.skip("No approved drivers in this store; skipping")
        driver_id = drivers[0]["driver_id"]

        # 3. accept order if pending
        if target["status"] == "pending":
            ar = requests.post(
                f"{API}/store/orders/{target['order_id']}/accept",
                headers=_h(manager_token),
            )
            assert ar.status_code == 200, ar.text

        # 4. assign
        assign = requests.post(
            f"{API}/store/orders/{target['order_id']}/assign-rider",
            headers=_h(manager_token),
            json={"driver_id": driver_id},
        )
        assert assign.status_code == 200, f"assign failed: {assign.status_code} {assign.text}"

        # 5. verify persistence via GET
        g = requests.get(
            f"{API}/store/orders/{target['order_id']}", headers=_h(manager_token)
        )
        assert g.status_code == 200
        body = g.json()
        assert body.get("driver_id") == driver_id
        assert body.get("driver_status") == "assigned"
