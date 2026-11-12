import os
import sys
from datetime import timedelta
import pytest
from fastapi import HTTPException

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    require_roles
)
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse, AuthResponse

def test_bcrypt_password_hashing():
    """Verify bcrypt salt hashing and verification."""
    raw = "SecureP@ssword2026"
    hashed = hash_password(raw)
    assert hashed != raw
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongP@ssword", hashed) is False
    assert verify_password("", hashed) is False

def test_jwt_token_creation_and_decoding():
    """Verify JWT payload signing, expiration, and decoding."""
    payload = {"sub": "usr-test-123", "email": "test@petrails.insure", "role": "Underwriter"}
    token = create_access_token(payload, expires_delta=timedelta(minutes=60))
    decoded = decode_access_token(token)
    assert decoded["sub"] == "usr-test-123"
    assert decoded["email"] == "test@petrails.insure"
    assert decoded["role"] == "Underwriter"
    assert "exp" in decoded

def test_jwt_token_expiration():
    """Verify expired token raises 401 Unauthorized."""
    payload = {"sub": "usr-expired", "email": "expired@petrails.insure", "role": "Underwriter"}
    expired_token = create_access_token(payload, expires_delta=timedelta(seconds=-10))
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(expired_token)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()

def test_jwt_invalid_token():
    """Verify forged/invalid token raises 401 Unauthorized."""
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token("not-a-valid-token")
    assert exc_info.value.status_code == 401
    assert "invalid" in exc_info.value.detail.lower()

def test_role_based_access_control():
    """Verify RBAC permits recognized roles and denies unauthorized access."""
    underwriter_guard = require_roles(["Underwriter", "Senior Underwriting Officer"])

    # Underwriter accessing underwriter route
    uw_token = {"sub": "u1", "role": "Senior Underwriting Officer"}
    res = underwriter_guard(uw_token)
    assert res["sub"] == "u1"

    # Administrator has universal access
    admin_token = {"sub": "adm1", "role": "Administrator"}
    res = underwriter_guard(admin_token)
    assert res["role"] == "Administrator"

    # Non-admin / wrong role forbidden
    claims_token = {"sub": "c1", "role": "Claims Officer"}
    with pytest.raises(HTTPException) as exc_info:
        underwriter_guard(claims_token)
    assert exc_info.value.status_code == 403

def test_auth_schemas():
    """Verify auth schemas conform to frontend contracts."""
    login_req = LoginRequest(email="sarah.jenkins@petrails.insure", password="Password123")
    assert login_req.email == "sarah.jenkins@petrails.insure"

    reg_req = RegisterRequest(
        organization="Tata AIG General Insurance",
        fullName="Ananya Rao",
        workEmail="ananya.rao@petrails.insure",
        role="Risk Analyst",
        authorityTier="tier-3"
    )
    assert reg_req.fullName == "Ananya Rao"
    assert reg_req.authorityTier == "tier-3"

    user_resp = UserResponse(
        id="usr-1",
        fullName="Sarah Jenkins",
        email="sarah.jenkins@petrails.insure",
        role="Senior Underwriting Officer",
        authorityLimitInr=500000,
        organization="Tata AIG General Insurance"
    )
    auth_resp = AuthResponse(token="jwt-token-xyz", user=user_resp)
    assert auth_resp.token == "jwt-token-xyz"
    assert auth_resp.user.authorityLimitInr == 500000

def test_unified_insurance_professional_role_and_tiers():
    """Verify unified Insurance Professional role and tier resolution."""
    from app.core.security import resolve_authority_limit, AUTHORITY_TIER_LIMITS

    # Default role in schema
    unified_req = RegisterRequest(
        organization="Bajaj Allianz",
        fullName="Karan Mehra",
        workEmail="karan@bajaj.insure",
        authorityTier="tier-1"
    )
    assert unified_req.role == "Insurance Professional"

    # Tier resolution
    assert resolve_authority_limit("tier-1") == 150000
    assert resolve_authority_limit("tier-2") == 500000
    assert resolve_authority_limit("tier-3") == 1000000
    assert resolve_authority_limit("tier-4") == 2500000

    # Role guard accepts Insurance Professional universally
    guard = require_roles(["Underwriter"])
    token = {"sub": "usr-ip-1", "role": "Insurance Professional"}
    res = guard(token)
    assert res["role"] == "Insurance Professional"

def test_registration_flow_success_and_duplicate():
    """Verify registration endpoint success, password hashing, and duplicate email prevention."""
    from app.api.routes_auth import register, TEST_USERS_STORE
    from app.core.security import verify_password, decode_access_token
    from pydantic import ValidationError

    def run_sync(coro):
        try:
            coro.send(None)
        except StopIteration as e:
            return e.value

    unique_email = f"officer-{id(register)}@digit.insure"
    req = RegisterRequest(
        organization="Digit General Insurance",
        fullName="Pooja Sharma",
        workEmail=unique_email,
        authorityTier="tier-2",
        password="SecurePass@2026"
    )

    # 1. Successful registration
    auth_resp = run_sync(register(req))
    assert auth_resp.token is not None
    assert auth_resp.user.email == unique_email
    assert auth_resp.user.fullName == "Pooja Sharma"
    assert auth_resp.user.role == "Insurance Professional"
    assert auth_resp.user.authorityTier == "tier-2"
    assert auth_resp.user.authorityLimitInr == 500000

    # Token payload verification
    decoded = decode_access_token(auth_resp.token)
    assert decoded["email"] == unique_email
    assert decoded["authorityTier"] == "tier-2"
    assert decoded["authorityLimitInr"] == 500000

    # Password is encrypted and not leaked in response
    assert not hasattr(auth_resp.user, "password")
    assert not hasattr(auth_resp.user, "hashedPassword")
    stored_doc = TEST_USERS_STORE[unique_email]
    assert verify_password("SecurePass@2026", stored_doc["hashedPassword"])

    # 2. Duplicate registration attempt -> HTTP 400
    with pytest.raises(HTTPException) as exc_info:
        run_sync(register(req))
    assert exc_info.value.status_code == 400
    assert "already registered" in exc_info.value.detail.lower()

    # 3. Schema validation error on missing required field
    with pytest.raises(ValidationError):
        RegisterRequest(
            organization="Digit",
            fullName="Missing Email"
            # workEmail omitted
        )
