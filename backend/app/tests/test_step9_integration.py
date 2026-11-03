import sys
import os
from pathlib import Path
import pytest
from fastapi import HTTPException

backend_dir = str(Path(__file__).resolve().parent.parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.api.routes_health import health_check
from app.api.routes_pets import list_pets, get_pet, TEST_PETS_STORE
from app.api.routes_assessments import list_assessments, TEST_ASSESSMENTS_STORE
from app.api.routes_claims import list_claims, TEST_CLAIMS_STORE
from app.api.routes_analytics import get_portfolio_analytics, TEST_METRICS_OVERRIDE
from app.api.routes_operations import list_information_requests, query_audit_logs, list_notifications
from app.core.security import decode_access_token
from app.api.routes_auth import register, login, get_current_user_profile
from app.schemas.auth import RegisterRequest, LoginRequest

def run_sync(coro):
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

def test_api_health_endpoint():
    """Verify health_check returns healthy status and service info."""
    res = run_sync(health_check())
    assert res.status == "healthy"
    assert res.service == settings.PROJECT_NAME
    assert res.database.connected is True

def test_api_pets_empty_returns_empty_list():
    """Verify list_pets returns an empty list when DB has no records, not a fake fallback."""
    TEST_PETS_STORE.clear()
    res = run_sync(list_pets())
    assert isinstance(res, list)
    assert len(res) == 0

def test_api_pet_not_found_raises_404():
    """Verify non-existent pet raises genuine 404 HTTPException rather than silent fallback."""
    TEST_PETS_STORE.clear()
    with pytest.raises(HTTPException) as exc_info:
        run_sync(get_pet("pet-nonexistent-123"))
    assert exc_info.value.status_code == 404
    assert "not found" in str(exc_info.value.detail).lower()

def test_api_assessments_empty_returns_empty_list():
    """Verify list_assessments returns an empty list when no assessments exist."""
    TEST_ASSESSMENTS_STORE.clear()
    res = run_sync(list_assessments())
    assert isinstance(res, list)
    assert len(res) == 0

def test_api_claims_empty_returns_empty_list():
    """Verify list_claims returns an empty list when no claims exist."""
    TEST_CLAIMS_STORE.clear()
    res = run_sync(list_claims())
    assert isinstance(res, list)
    assert len(res) == 0

def test_api_portfolio_analytics_returns_valid_contract():
    """Verify get_portfolio_analytics returns exact PortfolioMetrics shape with zero counts."""
    TEST_METRICS_OVERRIDE.clear()
    res = run_sync(get_portfolio_analytics())
    assert res.totalApplications == 0
    assert res.requireAttention == 0
    assert res.claimsUnderReview == 0
    assert res.informationGaps == 0
    assert res.riskDistribution.low == 0
    assert res.riskDistribution.medium == 0
    assert res.riskDistribution.high == 0
    assert isinstance(res.claimsActivity, list)
    assert isinstance(res.speciesBreakdown, list)
    assert isinstance(res.breedRiskTrends, list)

def test_api_operations_queues():
    """Verify information requests, audit logs, and notifications endpoints return lists."""
    info_res = run_sync(list_information_requests())
    assert isinstance(info_res, list)

    audit_res = run_sync(query_audit_logs())
    assert isinstance(audit_res, list)

    notif_res = run_sync(list_notifications())
    assert isinstance(notif_res, list)

def test_auth_invalid_credentials_raises_401():
    """Verify login with invalid credentials raises 401 HTTPException."""
    payload = LoginRequest(email="unregistered.officer@petrails.insure", password="WrongPassword@123")
    with pytest.raises(HTTPException) as exc_info:
        run_sync(login(payload))
    assert exc_info.value.status_code == 401
    assert "invalid" in str(exc_info.value.detail).lower()

def test_auth_registration_and_token_exchange():
    """Verify user registration returns valid token and user profile."""
    payload = RegisterRequest(
        organization="Bajaj Allianz Pet Health",
        fullName="Dr. Ananya Roy",
        workEmail="ananya.roy@bajajallianz.insure",
        role="Veterinary Medical Officer",
        authorityTier="tier-2",
        password="SecurePassword@2026"
    )
    res = run_sync(register(payload))
    assert res.token is not None
    assert res.user.fullName == "Dr. Ananya Roy"
    assert res.user.role == "Veterinary Medical Officer"
    assert res.user.authorityLimitInr == 500000

    token_payload = decode_access_token(res.token)
    user_me = run_sync(get_current_user_profile(token_payload))
    assert user_me.fullName == "Dr. Ananya Roy"
    assert user_me.email == "ananya.roy@bajajallianz.insure"
