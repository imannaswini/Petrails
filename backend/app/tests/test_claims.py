import os
import sys
import pytest
from fastapi import HTTPException

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.schemas.claim import (
    ClaimSchema,
    ClaimDecisionPayload,
    InvoiceDetailsSchema,
    EvidenceItemSchema
)
from app.api.routes_claims import (
    list_claims,
    get_claim,
    create_claim,
    record_claim_decision,
    TEST_CLAIMS_STORE
)
from app.services.intelligence_service import claims_anomaly_engine

def run_sync(coro):
    """Execute coroutine synchronously without event loop deadlock."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

@pytest.fixture(autouse=True)
def clean_store():
    TEST_CLAIMS_STORE.clear()

def test_claims_anomaly_detection_engine():
    """Verify anomaly engine calculates indicators and price deviations."""
    # Normal claim within market bounds
    normal_claim = {
        "amountInr": 15000.0,
        "invoiceDetails": {
            "standardMarketRangeInr": [10000.0, 25000.0]
        }
    }
    score, level, indicators = claims_anomaly_engine.evaluate_claim(normal_claim)
    assert score < 35
    assert level == "LOW CONCERN"
    assert any(i.status == "Low" for i in indicators)

    # Elevated claim exceeding upper threshold
    deviant_claim = {
        "amountInr": 65000.0,
        "invoiceDetails": {
            "standardMarketRangeInr": [15000.0, 30000.0]
        }
    }
    score_dev, level_dev, indicators_dev = claims_anomaly_engine.evaluate_claim(deviant_claim)
    assert score_dev >= 50
    assert level_dev in ["MODERATE CONCERN", "ELEVATED CONCERN"]
    assert any(i.status in ["Moderate", "Elevated"] for i in indicators_dev)

def test_claim_lifecycle_and_decision():
    """Verify claim creation, retrieval, and adjuster decision recording."""
    claim_payload = ClaimSchema(
        id="cl-test-01",
        claimNumber="CL-TEST-9901",
        petId="pet-test-01",
        petName="Simba",
        breed="Golden Retriever",
        species="Dog",
        claimType="Routine Diagnostics",
        treatment="Ultrasound Screening",
        amountInr=12500.0,
        date="2026-10-25",
        invoiceDetails=InvoiceDetailsSchema(
            invoiceNumber="INV-TEST-001",
            clinicName="Cessna Lifeline",
            totalBilledInr=12500.0,
            standardMarketRangeInr=[10000.0, 15000.0]
        ),
        medicalEvidence=[
            EvidenceItemSchema(
                id="ev-1",
                title="Abdominal Ultrasound Scan",
                type="Radiograph",
                date="2026-10-25",
                source="Cessna Lifeline"
            )
        ]
    )

    # 1. Create claim
    created = run_sync(create_claim(claim_payload))
    assert created["id"] == "cl-test-01"
    assert created["anomalyScore"] > 0
    assert len(created["indicators"]) > 0

    # 2. Retrieve claim
    retrieved = run_sync(get_claim("cl-test-01"))
    assert retrieved["claimNumber"] == "CL-TEST-9901"
    assert retrieved["treatment"] == "Ultrasound Screening"

    # 3. List claims
    all_claims = run_sync(list_claims())
    assert len(all_claims) == 1

    # 4. Record decision
    decision_payload = ClaimDecisionPayload(
        status="Approved",
        notes="Billed treatment is medically indicated and within standard fee guidelines.",
        approvedAmountInr=11250.0
    )
    dec_res = run_sync(record_claim_decision("cl-test-01", decision_payload))
    assert dec_res["success"] is True
    assert dec_res["decision"]["status"] == "Approved"
    assert dec_res["decision"]["approvedAmountInr"] == 11250.0

    # Verify claim updated status
    updated = run_sync(get_claim("cl-test-01"))
    assert updated["status"] == "Approved"
    assert updated["adjusterDecision"]["approvedAmountInr"] == 11250.0

