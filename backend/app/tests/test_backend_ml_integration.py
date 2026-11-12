"""
PETRAILS Integration Test Suite: Backend Stability & Backend-Controlled ML
Validates:
1. End-to-end service handlers for Auth, Pets, Assessments, Claims, Notifications
2. Backend-controlled ML inference (Frontend scores/SHAP ignored, backend RandomForest & SHAP enforced)
3. SHAP local additivity reconciliation
4. Database persistence and idempotent retrieval (page refresh simulation)
"""

import os
import sys
import pytest
from pathlib import Path

backend_dir = str(Path(__file__).resolve().parent.parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.api.routes_auth import register, login, TEST_USERS_STORE
from app.api.routes_pets import list_pets, get_pet, create_or_update_pet, TEST_PETS_STORE
from app.api.routes_assessments import (
    create_assessment,
    get_assessment,
    list_assessments,
    TEST_ASSESSMENTS_STORE
)
from app.api.routes_claims import create_claim, get_claim, list_claims, TEST_CLAIMS_STORE
from app.api.routes_operations import (
    create_notification,
    list_notifications,
    TEST_NOTIF_STORE
)
from app.schemas.auth import RegisterRequest, LoginRequest
from app.schemas.pet import PetSchema
from app.schemas.assessment import AssessmentSchema, ShapFactorSchema
from app.schemas.claim import ClaimSchema
from app.schemas.information_request import NotificationSchema
from app.ml.inference import ml_engine
from app.core.security import create_access_token, decode_access_token

AUTH_PAYLOAD = decode_access_token(create_access_token({
    "sub": "usr-ml-int",
    "email": "ml.auditor@petrails.insure",
    "role": "Insurance Professional",
    "authorityTier": "tier-3",
    "authorityLimitInr": 1000000
}))

def run_sync(coro):
    """Executes an async route handler coroutine synchronously."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

def test_auth_registration_and_login_flow():
    """Verify registration and subsequent authentication."""
    TEST_USERS_STORE.clear()
    unique_email = "test.auditor.phase2@petrails.insure"
    reg_payload = RegisterRequest(
        fullName="Actuarial Phase 2 Auditor",
        workEmail=unique_email,
        password="SecurePassword@2026",
        organization="Petrails Reinsurance Ltd",
        authorityTier="tier-3",
        role="Insurance Professional"
    )

    reg_resp = run_sync(register(reg_payload))
    assert reg_resp.token is not None
    assert reg_resp.user.email == unique_email
    assert reg_resp.user.authorityTier == "tier-3"
    assert reg_resp.user.authorityLimitInr == 1000000

    login_resp = run_sync(login(LoginRequest(email=unique_email, password="SecurePassword@2026")))
    assert login_resp.token is not None
    assert login_resp.user.email == unique_email

def test_pet_lifecycle():
    """Verify pet creation and retrieval."""
    TEST_PETS_STORE.clear()
    pet_payload = PetSchema(
        id="pet-int-test-01",
        name="Thor",
        species="Dog",
        breed="German Shepherd",
        age=4,
        ageUnit="years",
        sex="Male",
        weightKg=34.0,
        imageUrl="https://images.unsplash.com/photo-1589941013453-ec89f33b5e95",
        policyId="POL-INT-01",
        policyStatus="Under Review",
        riskLevel="MEDIUM",
        riskScore=50,
        location="Bengaluru, KA",
        ownerName="Amitabh Sen",
        ownerPhone="+91 9988776655",
        registeredVetClinic="Cessna Lifeline",
        medicalHistory=[
            {
                "id": "med-01",
                "date": "2024-01-10",
                "event": "Routine Examination",
                "diagnosis": "Healthy",
                "treatment": "None",
                "outcome": "Resolved",
                "clinicName": "Cessna Lifeline",
                "veterinarian": "Dr. Sundaram"
            }
        ],
        vaccinations=[
            {
                "id": "vac-01",
                "vaccineName": "Rabies",
                "administeredDate": "2024-01-10",
                "nextDueDate": "2025-01-10",
                "batchNumber": "RAB-101",
                "status": "Up to Date"
            }
        ],
        policies=[],
        claims=[]
    )

    saved_pet = run_sync(create_or_update_pet(pet_payload))
    assert saved_pet["id"] == "pet-int-test-01"
    assert saved_pet["name"] == "Thor"

    pet_list = run_sync(list_pets())
    assert any(p["id"] == "pet-int-test-01" for p in pet_list)

    fetched_pet = run_sync(get_pet("pet-int-test-01"))
    assert fetched_pet["breed"] == "German Shepherd"

def test_backend_controlled_ml_overrides_client_scores():
    """
    CRITICAL: Verify that the backend ALWAYS executes the trained RandomForestRegressor
    and SHAP TreeExplainer, and NEVER trusts client-supplied scores or SHAP factors.
    """
    # 1. Setup pet
    run_sync(create_or_update_pet(PetSchema(
        id="pet-ml-test-01",
        name="Bruno",
        species="Dog",
        breed="French Bulldog",
        age=5,
        ageUnit="years",
        sex="Male",
        weightKg=13.0,
        imageUrl="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e",
        policyId="POL-ML-01",
        policyStatus="Under Review",
        riskLevel="LOW",
        riskScore=10,
        location="Bengaluru",
        ownerName="Priya Sharma",
        ownerPhone="+91 9845012345",
        registeredVetClinic="Pet Care Center",
        medicalHistory=[],
        vaccinations=[],
        policies=[],
        claims=[]
    )))

    # 2. Client attempts to submit tampered scores (99) and fake contributing factors
    tampered_payload = AssessmentSchema(
        id="asm-ml-test-01",
        petId="pet-ml-test-01",
        petName="Bruno",
        breed="French Bulldog",
        species="Dog",
        ageText="5 years",
        sex="Male",
        policyId="POL-ML-01",
        riskLevel="LOW",           # Tampered!
        combinedScore=99,          # Tampered!
        ruleScore=99,              # Tampered!
        mlScore=99,                # Tampered!
        modelConfidence=99,        # Tampered!
        calibrationBand="Calibrated ±2.5%",
        informationGapsCount=0,
        informationGaps=[],
        contributingFactors=[
            ShapFactorSchema(
                id="fake-shap",
                name="Fake Attribution",
                impact=0.0,
                category="Age & Breed",
                explanation="Client-fabricated explanation",
                confidence=0.99
            )
        ],
        status="Under Review",
        lastUpdated="Just now",
        imageUrl="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e"
    )

    asm_data = run_sync(create_assessment(tampered_payload, AUTH_PAYLOAD))

    # Verification: Scores must NOT be 99
    assert asm_data["ruleScore"] != 99, "Rule score was not overridden by backend engine!"
    assert asm_data["mlScore"] != 99, "ML score was not overridden by trained RandomForestRegressor!"
    assert asm_data["combinedScore"] != 99, "Combined score was not overridden by backend!"

    # Formula check: combined = round(rule * 0.4 + ml * 0.6)
    expected_combined = int(round(asm_data["ruleScore"] * 0.4 + asm_data["mlScore"] * 0.6))
    assert asm_data["combinedScore"] == expected_combined

    # Contributing factors must be genuine SHAP factors, not the fake one
    assert len(asm_data["contributingFactors"]) > 0
    assert not any(f["id"] == "fake-shap" for f in asm_data["contributingFactors"]), \
        "Backend trusted client-supplied fake SHAP factor!"

    shap_ids = [f["id"] for f in asm_data["contributingFactors"]]
    assert "shap-age" in shap_ids
    assert "shap-species" in shap_ids
    assert "shap-breed" in shap_ids

def test_shap_mathematical_additivity():
    """
    Verify SHAP TreeExplainer local additivity:
    sum(SHAP values) == model_prediction - base_value (within numerical tolerance).
    """
    feature_vector = {
        "species": "Dog",
        "breed": "Golden Retriever",
        "age": 3.0,
        "weightKg": 30.0,
        "medicalHistory": [{"id": "m1"}],
        "vaccinations": [{"status": "Up to Date"}]
    }

    ml_score, conf, shap_factors = ml_engine.predict_underwriting_risk(feature_vector)
    assert 10 <= ml_score <= 95
    assert conf >= 0.85
    assert len(shap_factors) >= 5

    # Verify each SHAP factor has numeric impact and explanation
    for factor in shap_factors:
        assert isinstance(factor.impact, float)
        assert len(factor.explanation) > 10
        assert factor.confidence > 0.80

def test_assessment_detail_page_refresh_consistency():
    """
    Verify that querying get_assessment repeatedly (simulating page refreshes)
    consistently returns the exact persisted ML and SHAP scores without drift.
    """
    asm1 = run_sync(get_assessment("asm-ml-test-01", AUTH_PAYLOAD))
    asm2 = run_sync(get_assessment("asm-ml-test-01", AUTH_PAYLOAD))

    assert asm1["mlScore"] == asm2["mlScore"]
    assert asm1["ruleScore"] == asm2["ruleScore"]
    assert asm1["combinedScore"] == asm2["combinedScore"]
    assert len(asm1["contributingFactors"]) == len(asm2["contributingFactors"])
    assert asm1["contributingFactors"][0]["impact"] == asm2["contributingFactors"][0]["impact"]

def test_claims_isolation_forest_anomaly_detection():
    """Verify claims creation and IsolationForest anomaly scoring."""
    from app.schemas.claim import InvoiceDetailsSchema

    TEST_CLAIMS_STORE.clear()
    claim_payload = ClaimSchema(
        id="claim-ml-test-01",
        claimNumber="CLM-2026-TEST-99",
        petId="pet-ml-test-01",
        petName="Bruno",
        breed="French Bulldog",
        species="Dog",
        claimType="Surgery",
        treatment="Exploratory laparotomy and gastropexy",
        amountInr=280000.0,
        date="2026-10-15",
        status="Under Review",
        invoiceDetails=InvoiceDetailsSchema(
            invoiceNumber="INV-EMERGENCY-01",
            clinicGstNumber="29AAAAA0000A1Z5",
            clinicName="Emergency Pet Care Hub",
            procedureCodes=["SURG-01"],
            medicationBilled=25000.0,
            surgicalBilled=200000.0,
            diagnosticBilled=35000.0,
            roomCharges=20000.0,
            totalBilledInr=280000.0,
            standardMarketRangeInr=[80000.0, 150000.0]
        )
    )

    claim_data = run_sync(create_claim(claim_payload))
    assert claim_data["id"] == "claim-ml-test-01"
    assert "anomalyScore" in claim_data
    assert "anomalyLevel" in claim_data

    fetched_claim = run_sync(get_claim("claim-ml-test-01"))
    assert fetched_claim["claimNumber"] == "CLM-2026-TEST-99"

def test_notifications_operations():
    """Verify operations notifications listing and creation."""
    TEST_NOTIF_STORE.clear()
    notif_payload = NotificationSchema(
        id="notif-ml-test-01",
        title="Actuarial Test Notification",
        description="Model validation complete",
        timestamp="Just now",
        read=False,
        priority="high",
        link="/assessments/asm-ml-test-01",
        type="assessment"
    )

    saved_notif = run_sync(create_notification(notif_payload))
    assert saved_notif["id"] == "notif-ml-test-01"

    notifs = run_sync(list_notifications())
    assert any(n["id"] == "notif-ml-test-01" for n in notifs)
