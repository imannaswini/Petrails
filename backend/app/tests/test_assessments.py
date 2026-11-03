import os
import sys
import pytest
from fastapi import HTTPException

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.schemas.assessment import (
    AssessmentSchema,
    UnderwriterDecisionPayload,
    InformationRequestPayload,
    InformationGapSchema
)
from app.api.routes_assessments import (
    list_assessments,
    get_assessment,
    create_assessment,
    record_underwriter_decision,
    request_information,
    TEST_ASSESSMENTS_STORE
)
from app.services.intelligence_service import underwriting_rule_engine, predictive_risk_model

def run_sync(coro):
    """Execute coroutine synchronously without event loop deadlock."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

@pytest.fixture(autouse=True)
def clean_store():
    TEST_ASSESSMENTS_STORE.clear()

def test_intelligence_service_rules_and_scoring():
    """Verify actuarial rule engine and predictive scoring return deterministic calibrated outputs."""
    pet_data = {
        "age": 6,
        "breed": "Golden Retriever",
        "species": "Dog",
        "medicalHistory": [{"id": "m1", "event": "Cruciate laxity"}]
    }
    rule_score, rules = underwriting_rule_engine.evaluate_rules(pet_data)
    assert rule_score >= 50
    assert len(rules) >= 2  # Senior rule + breed predisposition

    ml_score, confidence, shap_factors = predictive_risk_model.predict_risk({
        **pet_data,
        "rule_score": rule_score
    })
    assert 0 <= ml_score <= 100
    assert confidence > 0.8
    assert len(shap_factors) >= 2

def test_assessment_lifecycle_workflow():
    """Verify assessment creation, retrieval, underwriter decision, and info request."""
    asm_payload = AssessmentSchema(
        id="asm-test-01",
        petId="pet-test-01",
        petName="Simba",
        breed="Golden Retriever",
        species="Dog",
        ageText="4 years",
        sex="Male",
        policyId="POL-TEST-001",
        informationGaps=[
            InformationGapSchema(
                id="gap-1",
                title="Vaccination Verification Needed",
                description="Needs booster records.",
                questions=["When was the last DHPP administered?"]
            )
        ]
    )
    # 1. Create assessment
    created = run_sync(create_assessment(asm_payload))
    assert created["id"] == "asm-test-01"
    assert created["combinedScore"] > 0
    assert len(created["contributingFactors"]) > 0

    # 2. Get assessment
    retrieved = run_sync(get_assessment("asm-test-01"))
    assert retrieved["petName"] == "Simba"

    # 3. Record decision
    dec_payload = UnderwriterDecisionPayload(
        decision="Approve",
        notes="Clinically approved under standard terms.",
        stipulation="Annual dental prophylaxis required."
    )
    dec_res = run_sync(record_underwriter_decision("asm-test-01", dec_payload))
    assert dec_res["success"] is True
    assert dec_res["decision"]["action"] == "Approve"

    # Verify status updated
    updated_asm = run_sync(get_assessment("asm-test-01"))
    assert updated_asm["status"] == "Approved"
    assert len(updated_asm["decisionHistory"]) == 1

    # 4. Request information
    info_payload = InformationRequestPayload(
        gapTitle="Vaccination Verification Needed",
        recipient="clinic",
        urgency="Standard (48h)",
        questions=["Please attach latest DHPP batch certificate."]
    )
    info_res = run_sync(request_information("asm-test-01", info_payload))
    assert info_res["success"] is True
    assert "dispatched" in info_res["message"].lower()

