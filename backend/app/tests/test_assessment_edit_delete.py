"""
PETRAILS Edit & Delete Assessment Test Suite
Verifies:
1. PUT /api/assessments/{id} updates supported pet/medical/insurance fields,
   recalculates Rule, ML, and SHAP scores on the backend, updates updatedAt,
   syncs linked pet fields, and records audit history.
2. Editing a finalized (Approved/Rejected) assessment is blocked with 409 Conflict
   unless reopenForReassessment=True, which transitions status to Under Review
   and clears selectedDecision.
3. Unauthorized users receive 403 Forbidden on PUT and DELETE.
4. DELETE /api/assessments/{id} soft-deletes/archives the assessment
   (isDeleted=True, status='Archived'), excludes it from list_assessments,
   returns 410 Gone on get_assessment, preserves linked pet and prior audit/decision history,
   and blocks Tier-1/Tier-2 from deleting finalized assessments (403) while allowing Admin.
"""

import os
import sys
import pytest
from fastapi import HTTPException

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.core.security import create_access_token, decode_access_token
from app.api.routes_auth import TEST_USERS_STORE
from app.api.routes_pets import create_or_update_pet, TEST_PETS_STORE
from app.api.routes_assessments import (
    list_assessments,
    get_assessment,
    create_assessment,
    update_assessment,
    delete_assessment,
    record_underwriter_decision,
    TEST_ASSESSMENTS_STORE,
    TEST_INFO_REQUESTS_STORE
)
from app.schemas.pet import PetSchema, PolicySummarySchema
from app.schemas.assessment import (
    AssessmentSchema,
    AssessmentUpdatePayload,
    UnderwriterDecisionPayload
)
import app.api.routes_assessments as routes_assessments


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


CAPTURED_AUDIT_LOGS: list[dict] = []


@pytest.fixture(autouse=True)
def reset_stores(monkeypatch):
    TEST_ASSESSMENTS_STORE.clear()
    TEST_INFO_REQUESTS_STORE.clear()
    TEST_PETS_STORE.clear()
    TEST_USERS_STORE.clear()
    CAPTURED_AUDIT_LOGS.clear()

    async def fake_log_audit_trail(**kwargs):
        CAPTURED_AUDIT_LOGS.append(kwargs)
        return kwargs

    monkeypatch.setattr(routes_assessments, "log_audit_trail", fake_log_audit_trail)


def seed_pet_and_assessment(owner_user: dict, pet_id: str = "pet-edit-1", asm_id: str = "asm-edit-1"):
    pet = PetSchema(
        id=pet_id,
        name="Bella",
        species="Dog",
        breed="Labrador Retriever",
        age=3,
        ageText="3 years",
        sex="Female",
        weightKg=24.0,
        ownerId=owner_user["sub"],
        ownerName=owner_user.get("fullName", "Owner One"),
        ownerEmail=owner_user["email"],
        ownerPhone="+91 9876543210",
        riskLevel="LOW",
        riskScore=35,
        policyId="pol-edit-1",
        medicalHistory=[{
            "id": "mh-1",
            "date": "2025-06-01",
            "event": "Routine checkup",
            "diagnosis": "Healthy",
            "treatment": "None",
            "outcome": "Resolved",
            "clinicName": "City Vet",
            "veterinarian": "Dr. Rao",
            "informationStatus": "VERIFIED"
        }],
        vaccinations=[{
            "id": "vac-1",
            "vaccineName": "Rabies",
            "administeredDate": "2025-06-01",
            "nextDueDate": "2026-06-01",
            "batchNumber": "RB-101",
            "status": "Up to Date",
            "informationStatus": "VERIFIED"
        }],
        policySummary=PolicySummarySchema(
            id="pol-edit-1",
            policyNumber="POL-1001",
            coverageTier="Standard",
            annualCoverageLimit=300000,
            deductible=5000,
            copayPercent=20,
            startDate="2026-01-01",
            renewalDate="2027-01-01",
            status="Active",
            previousInsurance="None"
        )
    )
    run_sync(create_or_update_pet(pet, owner_user))

    asm = AssessmentSchema(
        id=asm_id,
        petId=pet_id,
        policyId="pol-edit-1",
        petName="Bella",
        species="Dog",
        breed="Labrador Retriever",
        ageText="3 years",
        ageYears=3.0,
        sex="Female",
        weightKg=24.0,
        ownerId=owner_user["sub"],
        ownerName=owner_user.get("fullName", "Owner One"),
        ruleScore=30,
        mlScore=32,
        combinedScore=31,
        riskLevel="LOW",
        status="Under Review",
        createdByUserId=owner_user["sub"],
        createdByEmail=owner_user["email"],
        assignedUnderwriterId=owner_user["sub"],
        preExistingConditions="None",
        vaccinationDeclaration="Up to date",
        coverageTier="Standard",
        coverageLimitInr=300000,
        deductibleInr=5000,
        copayPercent=20
    )
    created = run_sync(create_assessment(asm, owner_user))
    return created


def test_edit_assessment_recalculates_scores_syncs_pet_and_records_audit():
    owner = make_jwt_payload("user-owner-1", "owner1@petrails.in", "tier-2", 500000, full_name="Rishikesh")
    created = seed_pet_and_assessment(owner)
    initial_created_at = created["createdAt"]
    initial_ml = created["mlScore"]
    initial_rule = created["ruleScore"]

    payload = AssessmentUpdatePayload(
        petName="Bella Updated",
        ageYears=11.0,
        weightKg=44.0,
        preExistingConditions="Chronic hip dysplasia and diabetes",
        previousIllnesses="Recurrent arthritis",
        previousSurgeries="Cruciate ligament repair",
        vaccinationDeclaration="Overdue",
        coverageTier="Comprehensive",
        coverageLimitInr=450000,
        deductibleInr=10000,
        copayPercent=15,
        editReason="Updated senior clinical history"
    )
    updated = run_sync(update_assessment(created["id"], payload, owner))

    assert updated["petName"] == "Bella Updated"
    assert updated["ageYears"] == 11.0
    assert updated["weightKg"] == 44.0
    assert updated["createdAt"] == initial_created_at
    assert updated["updatedAt"] >= initial_created_at
    # Backend ML, Rule & SHAP must be recalculated and higher for senior dog with chronic conditions
    assert updated["ruleScore"] != initial_rule or updated["mlScore"] != initial_ml
    assert updated["combinedScore"] >= created["combinedScore"]
    assert len(updated["contributingFactors"]) > 0

    # Linked pet synced
    synced_pet = TEST_PETS_STORE[created["petId"]]
    assert synced_pet["name"] == "Bella Updated"
    assert synced_pet["weightKg"] == 44.0
    assert updated["coverageTier"] == "Comprehensive"
    assert updated["coverageLimitInr"] == 450000
    if synced_pet.get("policies"):
        assert synced_pet["policies"][0]["tier"] == "Comprehensive"
        assert synced_pet["policies"][0]["annualCoverageLimit"] == 450000

    # DecisionHistory & Audit logs recorded
    assert len(updated["decisionHistory"]) >= 1
    assert any("Edited" in h["action"] for h in updated["decisionHistory"])
    assert len(CAPTURED_AUDIT_LOGS) >= 1
    latest_audit = CAPTURED_AUDIT_LOGS[-1]
    assert latest_audit["entity_id"] == created["id"]
    assert "changedFields" in latest_audit["details"]
    assert "previous" in latest_audit["details"]
    assert "updated" in latest_audit["details"]


def test_edit_finalized_assessment_requires_reopen_confirmation():
    owner = make_jwt_payload("user-owner-2", "owner2@petrails.in", "tier-2", 500000, full_name="Senior UW")
    created = seed_pet_and_assessment(owner, pet_id="pet-fin-1", asm_id="asm-fin-1")

    # Finalize via Approve
    run_sync(record_underwriter_decision(
        created["id"],
        UnderwriterDecisionPayload(decision="Approve", notes="Clean low risk"),
        owner
    ))
    assert TEST_ASSESSMENTS_STORE[created["id"]]["status"] == "Approved"

    # Attempt edit without reopenForReassessment -> 409 Conflict
    with pytest.raises(HTTPException) as exc:
        run_sync(update_assessment(
            created["id"],
            AssessmentUpdatePayload(weightKg=26.5),
            owner
        ))
    assert exc.value.status_code == 409

    # Confirm reopenForReassessment=True -> succeeds, transitions to Under Review, clears selectedDecision
    reopened = run_sync(update_assessment(
        created["id"],
        AssessmentUpdatePayload(weightKg=26.5, reopenForReassessment=True, editReason="Corrected weight"),
        owner
    ))
    assert reopened["status"] == "Under Review"
    assert reopened["underwriterDecision"]["selectedDecision"] is None
    assert reopened["weightKg"] == 26.5


def test_unauthorized_user_cannot_edit_or_delete_assessment():
    owner = make_jwt_payload("user-owner-3", "owner3@petrails.in", "tier-2", 500000, full_name="Owner Three")
    intruder = make_jwt_payload("user-intruder", "intruder@petrails.in", "tier-2", 500000, full_name="Intruder")
    created = seed_pet_and_assessment(owner, pet_id="pet-sec-1", asm_id="asm-sec-1")

    with pytest.raises(HTTPException) as edit_exc:
        run_sync(update_assessment(created["id"], AssessmentUpdatePayload(petName="Hacked"), intruder))
    assert edit_exc.value.status_code == 403

    with pytest.raises(HTTPException) as del_exc:
        run_sync(delete_assessment(created["id"], intruder))
    assert del_exc.value.status_code == 403


def test_delete_assessment_archives_preserves_pet_and_enforces_finalized_guard():
    tier2_owner = make_jwt_payload("user-uw-1", "uw1@petrails.in", "tier-2", 500000, full_name="Tier2 UW")
    admin_user = make_jwt_payload("user-admin-1", "admin@petrails.in", "tier-3", 5000000, role="Administrator", full_name="Admin User")

    # 1. Non-finalized assessment can be deleted by owner
    asm_open = seed_pet_and_assessment(tier2_owner, pet_id="pet-del-open", asm_id="asm-del-open")
    res_open = run_sync(delete_assessment(asm_open["id"], tier2_owner))
    assert res_open["success"] is True
    assert res_open["status"] == "Archived"
    assert TEST_ASSESSMENTS_STORE[asm_open["id"]]["isDeleted"] is True

    # Excluded from list_assessments
    listed = run_sync(list_assessments(tier2_owner))
    assert all(a["id"] != asm_open["id"] for a in listed)

    # Direct get_assessment returns 410 Gone
    with pytest.raises(HTTPException) as get_exc:
        run_sync(get_assessment(asm_open["id"], tier2_owner))
    assert get_exc.value.status_code == 410

    # Linked pet and audit log remain preserved
    assert "pet-del-open" in TEST_PETS_STORE
    assert any(log["entity_id"] == asm_open["id"] and log["action"] == "Assessment Archived / Deleted" for log in CAPTURED_AUDIT_LOGS)

    # 2. Finalized assessment cannot be deleted by Tier-2 owner -> 403 Forbidden
    asm_fin = seed_pet_and_assessment(tier2_owner, pet_id="pet-del-fin", asm_id="asm-del-fin")
    run_sync(record_underwriter_decision(
        asm_fin["id"],
        UnderwriterDecisionPayload(decision="Approve", notes="Approved before archive test"),
        tier2_owner
    ))
    with pytest.raises(HTTPException) as fin_exc:
        run_sync(delete_assessment(asm_fin["id"], tier2_owner))
    assert fin_exc.value.status_code == 403

    # 3. Admin can archive finalized assessment
    res_admin = run_sync(delete_assessment(asm_fin["id"], admin_user))
    assert res_admin["success"] is True
    assert res_admin["status"] == "Archived"
    assert TEST_ASSESSMENTS_STORE[asm_fin["id"]]["isDeleted"] is True
    # Prior decisionHistory preserved on archived record
    assert len(TEST_ASSESSMENTS_STORE[asm_fin["id"]]["decisionHistory"]) >= 1
