"""
PETRAILS Security Verification Test Suite — Assessment Module
Verifies:
1. Mandatory JWT authentication on ALL Assessment API endpoints (401 on missing/invalid/expired tokens)
2. Removal of optional-token bypass in record_underwriter_decision
3. Strict derivation of user identity, role, authorityTier, and authorityLimitInr from verified JWT
4. Rejection / ignoring of client-supplied user identities (no hardcoded 'Sarah Jenkins')
5. Enforcement of Tier-1 HIGH-risk approval restriction (403 Forbidden)
6. Enforcement of authorityLimitInr against linked policy annualCoverageLimit (403 Forbidden)
"""

import os
import sys
from datetime import timedelta
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.main import app
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_current_user_payload
)
from app.api.routes_auth import TEST_USERS_STORE
from app.api.routes_pets import create_or_update_pet, TEST_PETS_STORE
from app.api.routes_assessments import (
    router as assessments_router,
    list_assessments,
    get_assessment,
    create_assessment,
    record_underwriter_decision,
    request_information,
    TEST_ASSESSMENTS_STORE,
    TEST_INFO_REQUESTS_STORE
)
from app.schemas.pet import PetSchema, PolicySummarySchema
from app.schemas.assessment import (
    AssessmentSchema,
    UnderwriterDecisionPayload,
    InformationRequestPayload,
    InformationGapSchema
)

def run_sync(coro):
    """Execute async coroutine synchronously without event loop deadlock."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

def make_jwt_payload(
    sub: str,
    email: str,
    authority_tier: str,
    authority_limit_inr: int,
    role: str = "Insurance Professional",
    full_name: str | None = None
) -> dict:
    claims = {
        "sub": sub,
        "email": email,
        "role": role,
        "authorityTier": authority_tier,
        "authorityLimitInr": authority_limit_inr
    }
    if full_name is not None:
        claims["fullName"] = full_name
    token = create_access_token(claims)
    return decode_access_token(token)

@pytest.fixture(autouse=True)
def reset_stores():
    TEST_ASSESSMENTS_STORE.clear()
    TEST_INFO_REQUESTS_STORE.clear()
    TEST_PETS_STORE.clear()
    TEST_USERS_STORE.clear()

def test_all_assessment_routes_enforce_jwt_dependency():
    """Verify FastAPI router binds get_current_user_payload on every Assessment API endpoint."""
    included_assessments = [
        r for r in app.routes
        if getattr(r, "original_router", None) is assessments_router
        and getattr(getattr(r, "include_context", None), "prefix", None) == "/api/assessments"
    ]
    assert len(included_assessments) == 1

    routes = assessments_router.routes
    assert len(routes) == 9

    for route in routes:
        dep_calls = [d.call for d in route.dependant.dependencies]
        assert get_current_user_payload in dep_calls, (
            f"Route {route.methods} /api/assessments{route.path} does not enforce mandatory JWT dependency!"
        )

def test_unauthenticated_and_invalid_tokens_return_401():
    """Verify missing, malformed, and expired Bearer credentials raise HTTP 401."""
    # 1. Missing Bearer token
    with pytest.raises(HTTPException) as exc_missing:
        run_sync(get_current_user_payload(None))
    assert exc_missing.value.status_code == 401

    # 2. Tampered / invalid JWT
    bad_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.jwt.token")
    with pytest.raises(HTTPException) as exc_invalid:
        run_sync(get_current_user_payload(bad_creds))
    assert exc_invalid.value.status_code == 401

    # 3. Expired JWT
    expired_token = create_access_token(
        {"sub": "usr-exp", "email": "expired@petrails.insure", "role": "Insurance Professional"},
        expires_delta=timedelta(seconds=-30)
    )
    expired_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
    with pytest.raises(HTTPException) as exc_expired:
        run_sync(get_current_user_payload(expired_creds))
    assert exc_expired.value.status_code == 401

def test_handlers_reject_missing_token_payload_with_401():
    """Verify no optional-token bypass remains if handlers are invoked without valid JWT claims."""
    asm_payload = AssessmentSchema(
        id="asm-sec-unauth",
        petId="pet-sec-1",
        petName="Milo",
        breed="Beagle",
        species="Dog",
        ageText="3 years",
        sex="Male",
        policyId="POL-SEC-1"
    )
    dec_payload = UnderwriterDecisionPayload(decision="Approve", notes="Bypass attempt")
    info_payload = InformationRequestPayload(recipient="clinic", questions=["Check records?"])

    for call in [
        lambda: list_assessments(None),
        lambda: get_assessment("asm-sec-unauth", None),
        lambda: create_assessment(asm_payload, None),
        lambda: record_underwriter_decision("asm-sec-unauth", dec_payload, None),
        lambda: request_information("asm-sec-unauth", info_payload, None),
        lambda: record_underwriter_decision("asm-sec-unauth", dec_payload, {"role": "Insurance Professional"}),
    ]:
        with pytest.raises(HTTPException) as exc_info:
            run_sync(call())
        assert exc_info.value.status_code == 401

def test_jwt_identity_derived_and_client_user_ignored():
    """Verify actor name and role come strictly from verified JWT and ignore spoofed payload.user."""
    TEST_USERS_STORE["vikram.mehta@petrails.insure"] = {
        "id": "usr-vikram",
        "fullName": "Vikram Mehta",
        "email": "vikram.mehta@petrails.insure",
        "role": "Insurance Professional",
        "authorityTier": "tier-2",
        "authorityLimitInr": 500000
    }
    vikram_jwt = make_jwt_payload(
        sub="usr-vikram",
        email="vikram.mehta@petrails.insure",
        authority_tier="tier-2",
        authority_limit_inr=500000,
        role="Insurance Professional"
    )

    run_sync(create_assessment(
        AssessmentSchema(
            id="asm-sec-id-1",
            petId="pet-sec-id-1",
            petName="Leo",
            breed="Labrador",
            species="Dog",
            ageText="2 years",
            sex="Male",
            policyId="POL-ID-1",
            informationGaps=[
                InformationGapSchema(
                    id="gap-id-1",
                    title="Lab Records",
                    description="Need CBC",
                    questions=["Attach CBC?"]
                )
            ]
        ),
        vikram_jwt
    ))

    # Client attempts to spoof identity via payload.user
    spoof_decision = UnderwriterDecisionPayload(
        decision="Refer for Review",
        notes="Testing identity derivation",
        user="Sarah Jenkins"
    )
    res = run_sync(record_underwriter_decision("asm-sec-id-1", spoof_decision, vikram_jwt))
    assert res["success"] is True
    assert res["decision"]["user"] == "Vikram Mehta"
    assert res["decision"]["user"] != "Sarah Jenkins"
    assert res["decision"]["role"] == "Insurance Professional"

    stored = run_sync(get_assessment("asm-sec-id-1", vikram_jwt))
    assert stored["underwriterDecision"]["lastModifiedBy"] == "Vikram Mehta"
    assert stored["decisionHistory"][0]["user"] == "Vikram Mehta"

    # Also verify standalone JWT without DB/store user derives clean name from email (never Sarah Jenkins)
    alice_jwt = make_jwt_payload(
        sub="usr-alice",
        email="alice.kapoor@petrails.insure",
        authority_tier="tier-3",
        authority_limit_inr=1000000
    )
    run_sync(create_assessment(
        AssessmentSchema(
            id="asm-sec-id-alice",
            petId="pet-sec-id-1",
            petName="Leo",
            breed="Labrador",
            species="Dog",
            ageText="2 years",
            sex="Male",
            policyId="POL-ID-2",
            informationGaps=[
                InformationGapSchema(
                    id="gap-id-alice",
                    title="Lab Records",
                    description="Need CBC",
                    questions=["Attach CBC?"]
                )
            ]
        ),
        alice_jwt
    ))
    alice_res = run_sync(record_underwriter_decision(
        "asm-sec-id-alice",
        UnderwriterDecisionPayload(decision="Approve", notes="Verified", user="Fake Admin"),
        alice_jwt
    ))
    assert alice_res["decision"]["user"] == "Alice Kapoor"

    # Info request succeeds and updates assessment updatedAt + status
    info_res = run_sync(request_information(
        "asm-sec-id-alice",
        InformationRequestPayload(gapTitle="Lab Records", recipient="clinic", questions=["Send PDF"]),
        alice_jwt
    ))
    assert info_res["success"] is True

def test_tier1_restricted_from_high_risk_approval_returns_403():
    """Verify Tier-1 users receive HTTP 403 when trying to approve HIGH-risk assessments."""
    tier1_jwt = make_jwt_payload(
        sub="usr-tier1",
        email="tier1.officer@petrails.insure",
        authority_tier="tier-1",
        authority_limit_inr=150000,
        full_name="Arjun Rao"
    )
    senior_jwt = make_jwt_payload(
        sub="usr-senior",
        email="senior.officer@petrails.insure",
        authority_tier="tier-3",
        authority_limit_inr=1000000,
        role="Senior Underwriting Officer",
        full_name="Meera Krishnan"
    )

    # Create senior high-risk pet & assessment so ML+Rule produces HIGH riskLevel
    run_sync(create_or_update_pet(PetSchema(
        id="pet-sec-high",
        name="Max",
        species="Dog",
        breed="French Bulldog",
        age=9,
        weightKg=14.0,
        policyId="POL-HIGH-100K",
        ownerName="Karan Johar",
        medicalHistory=[
            {
                "id": "m1", "date": "2024-01-01", "event": "BOAS Surgery",
                "diagnosis": "Brachycephalic syndrome", "treatment": "Surgery",
                "outcome": "Managed", "clinicName": "VetCare", "veterinarian": "Dr. X"
            },
            {
                "id": "m2", "date": "2024-05-01", "event": "Chronic Otitis",
                "diagnosis": "Allergic otitis", "treatment": "Topical",
                "outcome": "Ongoing", "clinicName": "VetCare", "veterinarian": "Dr. X"
            }
        ],
        policies=[
            PolicySummarySchema(
                id="pol-high-1",
                policyNumber="POL-HIGH-100K",
                annualCoverageLimit=100000.0,
                startDate="2026-01-01",
                renewalDate="2027-01-01"
            )
        ]
    )))

    created = run_sync(create_assessment(
        AssessmentSchema(
            id="asm-sec-high",
            petId="pet-sec-high",
            petName="Max",
            breed="French Bulldog",
            species="Dog",
            ageText="9 years",
            sex="Male",
            policyId="POL-HIGH-100K"
        ),
        tier1_jwt
    ))
    assert created["riskLevel"] == "HIGH"

    # Tier-1 cannot approve HIGH risk even when coverage (100k) <= Tier-1 limit (150k)
    with pytest.raises(HTTPException) as exc_403:
        run_sync(record_underwriter_decision(
            "asm-sec-high",
            UnderwriterDecisionPayload(decision="Approve", notes="Attempt approval"),
            tier1_jwt
        ))
    assert exc_403.value.status_code == 403
    assert "tier 1" in exc_403.value.detail.lower()

    # Tier-1 CAN refer for review (status -> Referred)
    ref_res = run_sync(record_underwriter_decision(
        "asm-sec-high",
        UnderwriterDecisionPayload(decision="Refer for Review", notes="Escalating to senior"),
        tier1_jwt
    ))
    assert ref_res["success"] is True

    # Senior Underwriting Officer CAN approve escalated HIGH risk within 1M limit
    ok_res = run_sync(record_underwriter_decision(
        "asm-sec-high",
        UnderwriterDecisionPayload(decision="Approve", notes="Senior underwriting sign-off"),
        senior_jwt
    ))
    assert ok_res["success"] is True

def test_authority_limit_enforced_against_linked_policy_coverage():
    """
    Verify authorityLimitInr is enforced against linked policy annualCoverageLimit on approval,
    regardless of riskLevel (even LOW/MEDIUM risk policies require adequate monetary authority).
    """
    tier1_jwt = make_jwt_payload("u1", "t1@petrails.insure", "tier-1", 150000, full_name="Tier One")
    tier2_jwt = make_jwt_payload("u2", "t2@petrails.insure", "tier-2", 500000, full_name="Tier Two")
    tier3_jwt = make_jwt_payload("u3", "t3@petrails.insure", "tier-3", 1000000, full_name="Tier Three")
    tier4_jwt = make_jwt_payload("u4", "t4@petrails.insure", "tier-4", 2500000, full_name="Tier Four")

    # Case A: LOW/MEDIUM risk policy with ₹300,000 limit
    run_sync(create_or_update_pet(PetSchema(
        id="pet-cap-300k",
        name="Coco",
        species="Cat",
        breed="Indie",
        age=2,
        weightKg=4.0,
        policyId="POL-CAP-300K",
        ownerName="Neha Sharma",
        policies=[
            PolicySummarySchema(
                id="pol-300k",
                policyNumber="POL-CAP-300K",
                annualCoverageLimit=300000.0,
                startDate="2026-01-01",
                renewalDate="2027-01-01"
            )
        ]
    )))
    asm_300k = run_sync(create_assessment(
        AssessmentSchema(
            id="asm-cap-300k",
            petId="pet-cap-300k",
            petName="Coco",
            breed="Indie",
            species="Cat",
            ageText="2 years",
            sex="Female",
            policyId="POL-CAP-300K"
        ),
        tier1_jwt
    ))
    assert asm_300k["riskLevel"] in ("LOW", "MEDIUM")

    # Tier-1 (150k) must get 403 when approving 300k policy
    with pytest.raises(HTTPException) as exc_t1:
        run_sync(record_underwriter_decision(
            "asm-cap-300k",
            UnderwriterDecisionPayload(decision="Approve", notes="Over limit"),
            tier1_jwt
        ))
    assert exc_t1.value.status_code == 403
    assert "authority limit" in exc_t1.value.detail.lower()

    # Tier-2 (500k) can approve its own 300k policy
    run_sync(create_assessment(
        AssessmentSchema(
            id="asm-cap-300k-t2",
            petId="pet-cap-300k",
            petName="Coco",
            breed="Indie",
            species="Cat",
            ageText="2 years",
            sex="Female",
            policyId="POL-CAP-300K"
        ),
        tier2_jwt
    ))
    res_t2 = run_sync(record_underwriter_decision(
        "asm-cap-300k-t2",
        UnderwriterDecisionPayload(decision="Approve", notes="Within 500k cap"),
        tier2_jwt
    ))
    assert res_t2["success"] is True

    # Case B: Policy with ₹1,500,000 limit (exceeds Tier-2 500k and Tier-3 1M; within Tier-4 2.5M)
    run_sync(create_or_update_pet(PetSchema(
        id="pet-cap-1500k",
        name="Rocky",
        species="Dog",
        breed="Beagle",
        age=2,
        weightKg=11.0,
        policyId="POL-CAP-1500K",
        ownerName="Rohan Das",
        policies=[
            PolicySummarySchema(
                id="pol-1500k",
                policyNumber="POL-CAP-1500K",
                annualCoverageLimit=1500000.0,
                startDate="2026-01-01",
                renewalDate="2027-01-01"
            )
        ]
    )))
    run_sync(create_assessment(
        AssessmentSchema(
            id="asm-cap-1500k-t2",
            petId="pet-cap-1500k",
            petName="Rocky",
            breed="Beagle",
            species="Dog",
            ageText="2 years",
            sex="Male",
            policyId="POL-CAP-1500K"
        ),
        tier2_jwt
    ))
    run_sync(create_assessment(
        AssessmentSchema(
            id="asm-cap-1500k-t3",
            petId="pet-cap-1500k",
            petName="Rocky",
            breed="Beagle",
            species="Dog",
            ageText="2 years",
            sex="Male",
            policyId="POL-CAP-1500K"
        ),
        tier3_jwt
    ))
    run_sync(create_assessment(
        AssessmentSchema(
            id="asm-cap-1500k-t4",
            petId="pet-cap-1500k",
            petName="Rocky",
            breed="Beagle",
            species="Dog",
            ageText="2 years",
            sex="Male",
            policyId="POL-CAP-1500K"
        ),
        tier4_jwt
    ))

    for asm_id, low_jwt in [("asm-cap-1500k-t2", tier2_jwt), ("asm-cap-1500k-t3", tier3_jwt)]:
        with pytest.raises(HTTPException) as exc_over:
            run_sync(record_underwriter_decision(
                asm_id,
                UnderwriterDecisionPayload(decision="Approve", notes="Over authority cap"),
                low_jwt
            ))
        assert exc_over.value.status_code == 403
        assert "authority limit" in exc_over.value.detail.lower()

    # Non-approval actions (Refer for Review) remain allowed for escalation
    refer_res = run_sync(record_underwriter_decision(
        "asm-cap-1500k-t2",
        UnderwriterDecisionPayload(decision="Refer for Review", notes="Escalating high-limit policy"),
        tier2_jwt
    ))
    assert refer_res["success"] is True

    # Tier-4 (2.5M) approves 1.5M policy
    t4_res = run_sync(record_underwriter_decision(
        "asm-cap-1500k-t4",
        UnderwriterDecisionPayload(decision="Approve", notes="Tier-4 executive approval"),
        tier4_jwt
    ))
    assert t4_res["success"] is True

def test_user_isolation_between_registered_users_and_legacy_records():
    """
    Verify User A and User B see ONLY their own authorized assessments, and legacy unowned
    seed records (Simba, Bella, Milo) are never returned to newly registered users.
    """
    # Seed legacy unowned record + explicit demo seed record in store
    TEST_ASSESSMENTS_STORE["asm-legacy-simba"] = {
        "id": "asm-legacy-simba",
        "petId": "pet-simba",
        "petName": "Simba",
        "breed": "Golden Retriever",
        "species": "Dog",
        "policyId": "PT-15182",
        "riskLevel": "MEDIUM",
        "status": "Under Review",
        "lastUpdated": "Just now"
    }
    TEST_ASSESSMENTS_STORE["asm-demo-bella"] = {
        "id": "asm-demo-bella",
        "petId": "pet-bella",
        "petName": "Bella",
        "breed": "Labrador",
        "species": "Dog",
        "policyId": "POL-DEMO-1",
        "riskLevel": "LOW",
        "status": "Under Review",
        "isDemoSeed": True,
        "createdByUserId": "usr-a"
    }

    user_a_jwt = make_jwt_payload("usr-a", "user.a@petrails.insure", "tier-2", 500000, full_name="User Alpha")
    user_b_jwt = make_jwt_payload("usr-b", "user.b@petrails.insure", "tier-3", 1000000, full_name="User Beta")

    # 1. Newly registered User B sees 0 assessments (neither Simba nor Bella)
    assert run_sync(list_assessments(user_b_jwt)) == []

    # 2. User A creates an assessment WITHOUT client-supplied ID (backend generates ID)
    asm_a = run_sync(create_assessment(
        AssessmentSchema(
            petId="pet-alpha",
            petName="Zephyr",
            breed="Beagle",
            species="Dog",
            ageText="3 years",
            sex="Male",
            policyId="PT-ALPHA-1",
            createdByUserId="spoofed-other-user",  # Must be overwritten by JWT
            createdByEmail="spoof@evil.test"
        ),
        user_a_jwt
    ))
    assert asm_a["id"].startswith("asm-")
    assert asm_a["createdByUserId"] == "usr-a"
    assert asm_a["createdByEmail"] == "user.a@petrails.insure"

    # 3. User A sees ONLY Zephyr (not Simba or Bella)
    list_a = run_sync(list_assessments(user_a_jwt))
    assert [a["id"] for a in list_a] == [asm_a["id"]]

    # 4. User B STILL sees 0 assessments and gets 403 on User A's assessment & legacy record
    assert run_sync(list_assessments(user_b_jwt)) == []
    for target_id in (asm_a["id"], "asm-legacy-simba"):
        with pytest.raises(HTTPException) as exc_get:
            run_sync(get_assessment(target_id, user_b_jwt))
        assert exc_get.value.status_code == 403

        with pytest.raises(HTTPException) as exc_dec:
            run_sync(record_underwriter_decision(
                target_id,
                UnderwriterDecisionPayload(decision="Approve", notes="Cross-user attempt"),
                user_b_jwt
            ))
        assert exc_dec.value.status_code == 403

        with pytest.raises(HTTPException) as exc_info:
            run_sync(request_information(
                target_id,
                InformationRequestPayload(recipient="clinic", questions=["Cross-user info"]),
                user_b_jwt
            ))
        assert exc_info.value.status_code == 403

    # 5. User B creates their own assessment and sees ONLY their own record
    asm_b = run_sync(create_assessment(
        AssessmentSchema(
            petId="pet-beta",
            petName="Pixel",
            breed="Siamese",
            species="Cat",
            ageText="2 years",
            sex="Female",
            policyId="PT-BETA-1"
        ),
        user_b_jwt
    ))
    list_b = run_sync(list_assessments(user_b_jwt))
    assert [a["id"] for a in list_b] == [asm_b["id"]]
    assert asm_b["id"] != asm_a["id"]

def test_timestamps_utc_iso_and_created_at_preserved_on_update():
    """
    Verify backend generates UTC ISO 8601 createdAt/updatedAt, never hardcodes 'Just now',
    updates updatedAt on mutations, and never resets createdAt.
    """
    import time
    from datetime import datetime

    user_jwt = make_jwt_payload("usr-ts", "ts.tester@petrails.insure", "tier-3", 1000000, full_name="Time Auditor")
    created = run_sync(create_assessment(
        AssessmentSchema(
            petId="pet-ts-1",
            petName="Nova",
            breed="Poodle",
            species="Dog",
            ageText="4 years",
            sex="Female",
            policyId="PT-TS-1",
            informationGaps=[
                InformationGapSchema(
                    id="gap-ts-1",
                    title="Dental History",
                    description="Check dental grading",
                    questions=["Grade?"]
                )
            ]
        ),
        user_jwt
    ))

    created_at_initial = created["createdAt"]
    updated_at_initial = created["updatedAt"]
    assert created_at_initial.endswith("Z")
    assert updated_at_initial.endswith("Z")
    assert created["lastUpdated"] == updated_at_initial
    assert created["lastUpdated"] != "Just now"
    assert created_at_initial == updated_at_initial
    datetime.fromisoformat(created_at_initial.replace("Z", "+00:00"))

    time.sleep(0.02)
    dec_res = run_sync(record_underwriter_decision(
        created["id"],
        UnderwriterDecisionPayload(decision="Refer for Review", notes="Update timestamp test"),
        user_jwt
    ))
    updated_after_dec = dec_res["assessment"]
    assert updated_after_dec["createdAt"] == created_at_initial
    assert updated_after_dec["updatedAt"] > updated_at_initial
    assert updated_after_dec["lastUpdated"] == updated_after_dec["updatedAt"]

    time.sleep(0.02)
    info_res = run_sync(request_information(
        created["id"],
        InformationRequestPayload(gapTitle="Dental History", recipient="clinic", questions=["Send dental chart"]),
        user_jwt
    ))
    updated_after_info = info_res["assessment"]
    assert updated_after_info["createdAt"] == created_at_initial
    assert updated_after_info["updatedAt"] > updated_after_dec["updatedAt"]
    assert updated_after_info["status"] == "Information Requested"
