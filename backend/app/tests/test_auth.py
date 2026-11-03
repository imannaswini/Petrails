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
