"""Phase 5 backend tests: AI Support Bot + Admin (dashboard, users, tickets, wallet)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://order-analytics-26.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@dwaarit.com"
ADMIN_PASSWORD = "Admin@123"
DEMO_EMAIL = "demo@dwaarit.com"
DEMO_PASSWORD = "Demo@123"


# -------- Fixtures --------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def demo_user_id(demo_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["user_id"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# -------- Support: customer chat & ticket flows --------
class TestSupportChat:
    def test_chat_creates_ticket_and_returns_reply(self, demo_token):
        r = requests.post(
            f"{API}/support/chat",
            json={"message": "Where is my latest order?"},
            headers=_auth(demo_token),
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "ticket_id" in data and data["ticket_id"].startswith("tkt_")
        assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 0
        pytest.shared_ticket_id = data["ticket_id"]

    def test_chat_continues_existing_ticket(self, demo_token):
        tid = getattr(pytest, "shared_ticket_id", None)
        assert tid, "Previous chat test must run first"
        r = requests.post(
            f"{API}/support/chat",
            json={"ticket_id": tid, "message": "Thanks, please cancel if not yet shipped."},
            headers=_auth(demo_token),
            timeout=60,
        )
        assert r.status_code == 200
        assert r.json()["ticket_id"] == tid

    def test_list_tickets(self, demo_token):
        r = requests.get(f"{API}/support/tickets", headers=_auth(demo_token), timeout=15)
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 1
        assert any(t["ticket_id"] == pytest.shared_ticket_id for t in lst)

    def test_get_ticket_with_messages(self, demo_token):
        tid = pytest.shared_ticket_id
        r = requests.get(f"{API}/support/tickets/{tid}", headers=_auth(demo_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["ticket"]["ticket_id"] == tid
        # at least 4 messages: 2 user + 2 assistant
        assert len(d["messages"]) >= 4
        roles = [m["role"] for m in d["messages"]]
        assert "user" in roles and "assistant" in roles

    def test_get_ticket_unauthorized_other_user(self, admin_token):
        # admin viewing a customer's ticket via the customer route should be allowed (role==admin in code)
        tid = pytest.shared_ticket_id
        r = requests.get(f"{API}/support/tickets/{tid}", headers=_auth(admin_token), timeout=15)
        # Per support.py: admin allowed via that endpoint
        assert r.status_code == 200

    def test_chat_requires_auth(self):
        r = requests.post(f"{API}/support/chat", json={"message": "hi"}, timeout=15)
        assert r.status_code in (401, 403)


# -------- Admin: support tickets list / detail / reply / status --------
class TestAdminTickets:
    def test_admin_list_tickets(self, admin_token):
        r = requests.get(f"{API}/support/admin/tickets", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_list_tickets_requires_admin(self, demo_token):
        r = requests.get(f"{API}/support/admin/tickets", headers=_auth(demo_token), timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_get_ticket_detail(self, admin_token):
        tid = pytest.shared_ticket_id
        r = requests.get(f"{API}/admin/tickets/{tid}", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["ticket"]["ticket_id"] == tid
        assert isinstance(d["messages"], list)

    def test_admin_reply_to_ticket(self, admin_token, demo_token):
        tid = pytest.shared_ticket_id
        r = requests.post(
            f"{API}/admin/tickets/{tid}/reply",
            json={"message": "TEST_AGENT_REPLY: We are tracking your order."},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        # Verify message persisted
        r2 = requests.get(f"{API}/support/tickets/{tid}", headers=_auth(demo_token), timeout=15)
        assert r2.status_code == 200
        agent_msgs = [m for m in r2.json()["messages"] if m["role"] == "agent"]
        assert any("TEST_AGENT_REPLY" in m["content"] for m in agent_msgs)

    def test_admin_update_ticket_status(self, admin_token):
        tid = pytest.shared_ticket_id
        r = requests.patch(
            f"{API}/admin/tickets/{tid}/status",
            json={"status": "resolved"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "resolved"
        # verify
        r2 = requests.get(f"{API}/admin/tickets/{tid}", headers=_auth(admin_token), timeout=15)
        assert r2.json()["ticket"]["status"] == "resolved"


# -------- Admin Dashboard --------
class TestAdminDashboard:
    def test_dashboard_payload(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard", headers=_auth(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["today", "week", "lifetime", "status_counts", "series_7d", "top_products", "users", "tickets", "products"]:
            assert k in d, f"missing key {k}"
        # numeric fields
        assert isinstance(d["today"]["orders"], int)
        assert isinstance(d["today"]["revenue"], (int, float))
        assert isinstance(d["series_7d"], list)
        assert isinstance(d["top_products"], list)
        assert d["users"]["total"] >= 2

    def test_dashboard_requires_admin(self, demo_token):
        r = requests.get(f"{API}/admin/dashboard", headers=_auth(demo_token), timeout=15)
        assert r.status_code in (401, 403)


# -------- Admin Users / Role --------
class TestAdminUsers:
    def test_list_users(self, admin_token):
        r = requests.get(f"{API}/admin/users", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 2
        # _id excluded, no password
        for u in users:
            assert "_id" not in u
            assert "password_hash" not in u
            assert "user_id" in u and "email" in u and "role" in u
            assert "orders_count" in u and "total_spent" in u

    def test_search_users_by_email(self, admin_token):
        r = requests.get(f"{API}/admin/users?q=demo", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        assert any(u["email"] == DEMO_EMAIL for u in r.json())

    def test_role_change_round_trip(self, admin_token, demo_user_id):
        # Promote demo -> admin then revert (do NOT leave demo as admin)
        r1 = requests.patch(
            f"{API}/admin/users/{demo_user_id}/role",
            json={"role": "admin"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r1.status_code == 200
        assert r1.json()["role"] == "admin"
        # Revert
        r2 = requests.patch(
            f"{API}/admin/users/{demo_user_id}/role",
            json={"role": "customer"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["role"] == "customer"
        # Verify in list
        r3 = requests.get(f"{API}/admin/users?q=demo", headers=_auth(admin_token), timeout=15)
        demo_u = next((u for u in r3.json() if u["email"] == DEMO_EMAIL), None)
        assert demo_u and demo_u["role"] == "customer", "Demo user must be reverted to customer"


# -------- Admin Wallet adjustments --------
class TestAdminWallet:
    def test_list_wallet_txns(self, admin_token):
        r = requests.get(f"{API}/admin/wallet/transactions", headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_credit_then_debit_demo(self, admin_token, demo_token, demo_user_id):
        # initial balance (endpoint is GET /api/wallet)
        b0 = requests.get(f"{API}/wallet", headers=_auth(demo_token), timeout=15).json()
        initial = b0.get("balance", 0)

        # credit ₹10
        c = requests.post(
            f"{API}/admin/wallet/adjust",
            json={"user_id": demo_user_id, "type": "credit", "amount": 10, "note": "TEST_credit"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert c.status_code == 200, c.text
        new_bal = c.json().get("balance")
        assert new_bal is not None
        assert round(new_bal - initial, 2) == 10.0, f"Expected +10 got {new_bal - initial}"

        # revert -- debit ₹10
        d = requests.post(
            f"{API}/admin/wallet/adjust",
            json={"user_id": demo_user_id, "type": "debit", "amount": 10, "note": "TEST_debit_revert"},
            headers=_auth(admin_token),
            timeout=15,
        )
        assert d.status_code == 200, d.text
        reverted_bal = d.json().get("balance")
        assert round(reverted_bal - initial, 2) == 0.0, f"Expected revert to {initial}, got {reverted_bal}"

    def test_adjust_requires_admin(self, demo_token, demo_user_id):
        r = requests.post(
            f"{API}/admin/wallet/adjust",
            json={"user_id": demo_user_id, "type": "credit", "amount": 5},
            headers=_auth(demo_token),
            timeout=15,
        )
        assert r.status_code in (401, 403)


# -------- Regression: existing endpoints --------
class TestRegression:
    def test_products_list(self, demo_token):
        r = requests.get(f"{API}/products", headers=_auth(demo_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_categories_list(self):
        r = requests.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200

    def test_orders_list(self, demo_token):
        r = requests.get(f"{API}/orders", headers=_auth(demo_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
