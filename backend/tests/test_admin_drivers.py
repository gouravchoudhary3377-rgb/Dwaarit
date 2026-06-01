"""Phase 8.2 Admin Driver Management — backend API tests.

Tests:
  • Login as super_admin
  • GET /api/admin/drivers (auth gating + listing)
  • POST /api/admin/drivers (create new driver)
  • Persistence verification via GET after POST
  • Auth gating: no-token returns 401/403
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://dwaarit-grocery.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@dwaarit.com"
ADMIN_PASSWORD = "Admin@123"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api_client):
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"No token in login response: {data}"
    role = (data.get("user") or {}).get("role")
    assert role in ("super_admin", "admin"), f"Expected admin role, got {role}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}


# ---------- Health & auth gating ----------
class TestAuthGating:
    def test_drivers_list_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/admin/drivers", timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403 unauth, got {r.status_code}"


# ---------- Drivers listing ----------
class TestDriversList:
    def test_list_drivers_ok(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/admin/drivers", headers=auth_headers, timeout=20)
        assert r.status_code == 200, f"GET drivers failed: {r.status_code} {r.text}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data).__name__}"
        # Ensure no _id leaks
        for d in data:
            assert "_id" not in d
            assert "password_hash" not in d


# ---------- Create driver ----------
class TestCreateDriver:
    """Create → GET to verify persistence."""

    @pytest.fixture(scope="class")
    def new_driver_email(self):
        # Unique email to avoid 409 across reruns
        return f"TEST_rider_{uuid.uuid4().hex[:6]}@dwaarit.com"

    def test_create_driver(self, api_client, auth_headers, new_driver_email, request):
        payload = {
            "name": "Test Rider",
            "email": new_driver_email,
            "phone": "+919999900001",
            "vehicle_type": "bike",
            "password": "Rider@123",
        }
        r = api_client.post(
            f"{BASE_URL}/api/admin/drivers",
            json=payload,
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code in (200, 201), f"Create failed: {r.status_code} {r.text}"
        d = r.json()
        assert d.get("email") == new_driver_email.lower()
        assert d.get("name") == "Test Rider"
        assert d.get("vehicle_type") == "bike"
        assert d.get("status") == "approved"
        assert d.get("driver_id")
        assert "_id" not in d
        assert "password_hash" not in d
        # stash for next test
        request.config.cache.set("driver_id", d["driver_id"])

    def test_created_driver_in_list(self, api_client, auth_headers, new_driver_email, request):
        driver_id = request.config.cache.get("driver_id", None)
        assert driver_id, "Previous test didn't set driver_id"
        r = api_client.get(f"{BASE_URL}/api/admin/drivers", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        ids = [x.get("driver_id") for x in r.json()]
        assert driver_id in ids, "Newly created driver missing from list"

    def test_get_driver_detail(self, api_client, auth_headers, request):
        driver_id = request.config.cache.get("driver_id", None)
        assert driver_id
        r = api_client.get(f"{BASE_URL}/api/admin/drivers/{driver_id}", headers=auth_headers, timeout=20)
        assert r.status_code == 200, f"GET detail failed: {r.status_code} {r.text}"
        body = r.json()
        assert "driver" in body and body["driver"].get("driver_id") == driver_id

    def test_duplicate_email_rejected(self, api_client, auth_headers, new_driver_email):
        payload = {
            "name": "Dup",
            "email": new_driver_email,
            "phone": "+919999900002",
            "vehicle_type": "bike",
            "password": "Rider@123",
        }
        r = api_client.post(
            f"{BASE_URL}/api/admin/drivers",
            json=payload,
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 409, f"Expected 409 dup, got {r.status_code} {r.text}"

    def test_cleanup_delete_driver(self, api_client, auth_headers, request):
        driver_id = request.config.cache.get("driver_id", None)
        if not driver_id:
            pytest.skip("no driver to clean")
        r = api_client.delete(f"{BASE_URL}/api/admin/drivers/{driver_id}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
