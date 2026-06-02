"""Phase 8.6 — Retest (iteration 17) for the 3 bug fixes + 2 previously-skipped.

Scope (only the items the main agent asked to retest):
- Bug #1: require_super_admin strict. role='admin' -> 403 on
    GET /api/admin/audit-logs, /api/admin/login-history, /api/admin/security/summary
  super_admin -> 200.
- Bug #2: Failed login writes audit_logs (action='auth.login', status='failure')
  for both bad_password and not_found email paths.
- Bug #3: PATCH /api/admin/users/{id}/role writes audit_logs
  (action='role.change', status='success', details.previous_role, details.new_role)
  AND the endpoint is gated by require_super_admin (admin caller -> 403).
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SUPER_ADMIN = {"email": "admin@dwaarit.com", "password": "Admin@123"}
CUSTOMER = {"email": "demo@dwaarit.com", "password": "Demo@123"}

VIEWER_ENDPOINTS = [
    "/admin/audit-logs",
    "/admin/login-history",
    "/admin/security/summary",
]


# ---------------- helpers ----------------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


def _login(s, creds):
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login {creds['email']} -> {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="session")
def super_admin_token(s):
    tok, user = _login(s, SUPER_ADMIN)
    assert user["role"] == "super_admin", f"seed admin role={user['role']} (expected super_admin)"
    return tok


@pytest.fixture(scope="session")
def admin_role_user(s, super_admin_token):
    """Create a fresh user and promote to role='admin' (NOT super_admin)."""
    email = f"TEST_iter17_admin_{uuid.uuid4().hex[:8]}@dwaarit-test.com"
    password = "Passw0rd!1"
    rs = s.post(
        f"{API}/auth/signup",
        json={"email": email, "name": "Admin Tgt", "password": password},
        timeout=20,
    )
    assert rs.status_code == 200, rs.text
    uid = rs.json()["user"]["user_id"]
    r = s.patch(
        f"{API}/admin/users/{uid}/role",
        headers=_hdr(super_admin_token),
        json={"role": "admin"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    lr = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert lr.status_code == 200, lr.text
    return {
        "token": lr.json()["token"],
        "user_id": lr.json()["user"]["user_id"],
        "role": lr.json()["user"]["role"],
        "email": email,
    }


# ---------------- Bug #1: require_super_admin is strict ----------------
class TestBug1RequireSuperAdminStrict:
    def test_admin_role_user_has_role_admin(self, admin_role_user):
        assert admin_role_user["role"] == "admin", (
            f"setup precondition: expected role=admin, got {admin_role_user['role']}"
        )

    @pytest.mark.parametrize("path", VIEWER_ENDPOINTS)
    def test_super_admin_still_200(self, s, super_admin_token, path):
        r = s.get(f"{API}{path}", headers=_hdr(super_admin_token), timeout=20)
        assert r.status_code == 200, r.text

    @pytest.mark.parametrize("path", VIEWER_ENDPOINTS)
    def test_admin_role_403(self, s, admin_role_user, path):
        r = s.get(f"{API}{path}", headers=_hdr(admin_role_user["token"]), timeout=20)
        assert r.status_code == 403, (
            f"{path} expected 403 for role=admin, got {r.status_code} body={r.text}"
        )


# ---------------- Bug #2: Failed login writes audit_logs ----------------
class TestBug2FailedLoginAudit:
    def test_bad_password_writes_audit_failure(self, s, super_admin_token):
        # demo@dwaarit.com exists; send wrong password
        # First sleep a bit to clear any unrelated noise; not strictly required
        marker_email = CUSTOMER["email"].lower()
        r = s.post(
            f"{API}/auth/login",
            json={"email": CUSTOMER["email"], "password": "definitely-wrong-zzz"},
            timeout=20,
        )
        assert r.status_code == 401, r.text
        time.sleep(0.6)

        a = s.get(
            f"{API}/admin/audit-logs",
            headers=_hdr(super_admin_token),
            params={"action": "auth.login", "status": "failure", "limit": 20},
            timeout=20,
        )
        assert a.status_code == 200, a.text
        body = a.json()
        assert body["total"] >= 1, "expected at least one audit_logs auth.login failure entry"
        # Find an item whose details.email matches our marker
        matched = [
            it for it in body["items"]
            if it.get("action") == "auth.login"
            and it.get("status") == "failure"
            and (it.get("details") or {}).get("email") == marker_email
        ]
        assert matched, (
            f"no auth.login failure entry for {marker_email} found in: "
            f"{[ (it.get('action'), it.get('status'), (it.get('details') or {}).get('email')) for it in body['items'] ]}"
        )

    def test_not_found_email_writes_audit_failure(self, s, super_admin_token):
        nonexistent = f"TEST_nf_{uuid.uuid4().hex[:8]}@dwaarit-test.com"
        r = s.post(
            f"{API}/auth/login",
            json={"email": nonexistent, "password": "anything"},
            timeout=20,
        )
        assert r.status_code == 401, r.text
        time.sleep(0.6)

        a = s.get(
            f"{API}/admin/audit-logs",
            headers=_hdr(super_admin_token),
            params={"action": "auth.login", "status": "failure", "limit": 50},
            timeout=20,
        )
        assert a.status_code == 200, a.text
        items = a.json()["items"]
        matched = [
            it for it in items
            if (it.get("details") or {}).get("email") == nonexistent.lower()
        ]
        assert matched, (
            f"no auth.login failure entry for not_found email {nonexistent}"
        )
        # Optional: when present, reason should be 'not_found'
        reasons = {(it.get("details") or {}).get("reason") for it in matched}
        assert "not_found" in reasons or reasons == {None}, (
            f"expected reason='not_found' for non-existent email, got {reasons}"
        )


# ---------------- Bug #3: role.change audit + super_admin gate ----------------
class TestBug3RoleChangeAuditAndGate:
    def test_role_change_writes_audit_with_prev_and_new(self, s, super_admin_token):
        # Create a fresh user, promote to admin
        email = f"TEST_iter17_role_{uuid.uuid4().hex[:8]}@dwaarit-test.com"
        rs = s.post(
            f"{API}/auth/signup",
            json={"email": email, "name": "Role Tgt", "password": "Passw0rd!1"},
            timeout=20,
        )
        assert rs.status_code == 200, rs.text
        uid = rs.json()["user"]["user_id"]
        prev_role = rs.json()["user"]["role"]  # should be 'customer'

        r = s.patch(
            f"{API}/admin/users/{uid}/role",
            headers=_hdr(super_admin_token),
            json={"role": "admin"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        time.sleep(0.6)

        a = s.get(
            f"{API}/admin/audit-logs",
            headers=_hdr(super_admin_token),
            params={"action": "role.change", "limit": 20},
            timeout=20,
        )
        assert a.status_code == 200, a.text
        items = a.json()["items"]
        # Find the entry for this target
        matched = []
        for it in items:
            det = it.get("details") or {}
            if det.get("target_user_id") == uid or det.get("user_id") == uid:
                matched.append(it)
        assert matched, (
            f"no role.change audit_logs entry found for target {uid}; "
            f"recent role.change items details={[ (it.get('details') or {}) for it in items[:5] ]}"
        )
        first = matched[0]
        assert first.get("action") == "role.change"
        assert first.get("status", "success") == "success"
        details = first.get("details") or {}
        assert details.get("previous_role") == prev_role, (
            f"previous_role mismatch: got {details.get('previous_role')} want {prev_role}"
        )
        assert details.get("new_role") == "admin", (
            f"new_role mismatch: got {details.get('new_role')} want 'admin'"
        )

    def test_admin_role_caller_403_on_role_change(self, s, admin_role_user, super_admin_token):
        # Create a victim user, then ensure role=admin caller cannot change role
        victim_email = f"TEST_iter17_victim_{uuid.uuid4().hex[:8]}@dwaarit-test.com"
        rs = s.post(
            f"{API}/auth/signup",
            json={"email": victim_email, "name": "Victim", "password": "Passw0rd!1"},
            timeout=20,
        )
        assert rs.status_code == 200, rs.text
        victim_uid = rs.json()["user"]["user_id"]

        r = s.patch(
            f"{API}/admin/users/{victim_uid}/role",
            headers=_hdr(admin_role_user["token"]),
            json={"role": "rider"},
            timeout=20,
        )
        assert r.status_code == 403, (
            f"role=admin caller must be 403 on PATCH /admin/users/{victim_uid}/role, "
            f"got {r.status_code} body={r.text}"
        )
