"""
PETRAILS Veterinary Document Intelligence Test Suite
Verifies:
1. Image OCR (RapidOCR) and structured medical extraction on a real generated veterinary image
2. Comparison against existing declarations (MATCH, DISCREPANCY, MISSING_IN_DECLARATION)
3. Strict integrity: uploaded document is NOT auto-verified and does NOT alter risk score
4. Underwriter review & acceptance of selected corrections updates declarations & audit history
5. Authorization (403) and file type validation (400)
"""

import asyncio
import io
import os
import sys
import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageDraw, ImageFont

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.core.security import create_access_token, decode_access_token
from app.api.routes_auth import TEST_USERS_STORE
from app.api.routes_pets import create_or_update_pet, TEST_PETS_STORE
from app.api.routes_assessments import (
    create_assessment,
    upload_assessment_document,
    review_assessment_document,
    TEST_ASSESSMENTS_STORE,
    TEST_INFO_REQUESTS_STORE
)
import app.api.routes_assessments as routes_assessments
from app.schemas.pet import PetSchema, PolicySummarySchema
from app.schemas.assessment import AssessmentSchema, DocumentReviewPayload
from app.services.document_intelligence_service import (
    parse_veterinary_text_deterministic,
    compare_extracted_with_declarations
)


def run_sync(coro):
    return asyncio.run(coro)


def make_jwt_payload(sub: str, email: str, full_name: str = "Dr. Underwriter") -> dict:
    token = create_access_token({
        "sub": sub,
        "email": email,
        "role": "Insurance Professional",
        "authorityTier": "tier-2",
        "authorityLimitInr": 500000,
        "fullName": full_name
    })
    return decode_access_token(token)


CAPTURED_AUDITS: list[dict] = []


@pytest.fixture(autouse=True)
def reset_stores(monkeypatch):
    TEST_ASSESSMENTS_STORE.clear()
    TEST_INFO_REQUESTS_STORE.clear()
    TEST_PETS_STORE.clear()
    TEST_USERS_STORE.clear()
    CAPTURED_AUDITS.clear()

    async def fake_audit(**kwargs):
        CAPTURED_AUDITS.append(kwargs)
        return kwargs

    monkeypatch.setattr(routes_assessments, "log_audit_trail", fake_audit)


def seed_assessment(owner: dict, asm_id: str = "asm-doc-1", pet_id: str = "pet-doc-1"):
    pet = PetSchema(
        id=pet_id,
        name="Buddy",
        species="Dog",
        breed="Golden Retriever",
        age=5,
        ageText="5 years",
        sex="Male",
        weightKg=30.0,
        ownerId=owner["sub"],
        ownerName=owner["fullName"],
        ownerEmail=owner["email"],
        ownerPhone="+91 9876500000",
        riskLevel="MEDIUM",
        riskScore=52,
        policyId="pol-doc-1",
        policySummary=PolicySummarySchema(
            id="pol-doc-1",
            policyNumber="POL-DOC-1",
            coverageTier="Standard",
            annualCoverageLimit=300000,
            deductible=5000,
            copayPercent=20,
            startDate="2026-01-01",
            renewalDate="2027-01-01",
            status="Active"
        )
    )
    run_sync(create_or_update_pet(pet, owner))

    asm = AssessmentSchema(
        id=asm_id,
        petId=pet_id,
        policyId="pol-doc-1",
        petName="Buddy",
        species="Dog",
        breed="Golden Retriever",
        ageText="5 years",
        ageYears=5.0,
        sex="Male",
        weightKg=30.0,
        ruleScore=50,
        mlScore=50,
        combinedScore=50,
        riskLevel="MEDIUM",
        status="Under Review",
        createdByUserId=owner["sub"],
        createdByEmail=owner["email"],
        assignedUnderwriterId=owner["sub"],
        underwritingData={
            "preExistingConditions": "None",
            "previousIllnesses": "Mild ear infection 2024",
            "vaccinationDeclaration": "Rabies Up to Date"
        }
    )
    return run_sync(create_assessment(asm, owner))


def _make_vet_report_png() -> bytes:
    img = Image.new("RGB", (900, 420), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    lines = [
        "VETERINARY CLINICAL SUMMARY",
        "Clinic: Metro Pet Hospital",
        "Veterinarian: Dr. Meera Nair",
        "Date: 2026-02-15",
        "Pre-existing Conditions: Chronic hip dysplasia",
        "Previous Surgeries: Left TPLO knee surgery",
        "Current Medications: Carprofen 75mg daily",
        "Vaccinations: Rabies Up to Date"
    ]
    y = 25
    for line in lines:
        draw.text((30, y), line, fill=(0, 0, 0))
        y += 42
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_deterministic_parser_and_comparison_flags_discrepancies_and_missing():
    text = (
        "Clinic: CareVet Clinic\n"
        "Veterinarian: Dr. Arjun Rao\n"
        "Pre-existing Conditions: Chronic hip dysplasia\n"
        "Previous Surgeries: Left TPLO knee surgery\n"
        "Current Medications: Carprofen 75mg\n"
        "Vaccinations: Rabies Up to Date\n"
    )
    extracted = parse_veterinary_text_deterministic(text)
    assert extracted["clinicName"] == "CareVet Clinic"
    assert extracted["preExistingConditions"] == "Chronic hip dysplasia"
    assert extracted["previousSurgeries"] == "Left TPLO knee surgery"
    assert extracted["currentMedications"] == "Carprofen 75mg"

    asm = {
        "underwritingData": {
            "preExistingConditions": "None",
            "vaccinationDeclaration": "Rabies Up to Date",
            "allergies": "Chicken"
        }
    }
    comparisons, counts = compare_extracted_with_declarations(extracted, asm)
    by_field = {c["field"]: c for c in comparisons}

    assert by_field["preExistingConditions"]["status"] == "DISCREPANCY"
    assert by_field["previousSurgeries"]["status"] == "MISSING_IN_DECLARATION"
    assert by_field["currentMedications"]["status"] == "MISSING_IN_DECLARATION"
    assert by_field["vaccinationDeclaration"]["status"] == "MATCH"
    assert by_field["allergies"]["status"] == "MISSING_IN_DOCUMENT"
    assert counts["discrepanciesCount"] == 1
    assert counts["missingInDeclarationCount"] == 2
    assert counts["matchesCount"] == 1


def test_upload_and_review_veterinary_image_preserves_risk_score_and_does_not_auto_verify():
    owner = make_jwt_payload("user-doc-1", "doc1@petrails.in")
    created = seed_assessment(owner)
    orig_combined = created["combinedScore"]
    orig_rule = created["ruleScore"]
    orig_ml = created["mlScore"]
    orig_risk = created["riskLevel"]

    png_bytes = _make_vet_report_png()
    upload = UploadFile(filename="vet_report.png", file=io.BytesIO(png_bytes))
    res = run_sync(upload_assessment_document(created["id"], upload, owner))

    doc = res["document"]
    updated_asm = res["assessment"]

    assert doc["extractionMethod"] == "IMAGE_OCR"
    assert doc["verificationStatus"] == "EXTRACTED_UNVERIFIED"
    assert doc["reviewStatus"] == "PENDING_REVIEW"

    # Risk score MUST NOT change on document upload
    assert updated_asm["combinedScore"] == orig_combined
    assert updated_asm["ruleScore"] == orig_rule
    assert updated_asm["mlScore"] == orig_ml
    assert updated_asm["riskLevel"] == orig_risk

    # Review and accept corrections for extracted fields
    extracted_non_empty = [
        k for k in ("preExistingConditions", "previousSurgeries", "currentMedications")
        if doc["extractedFields"].get(k)
    ]
    assert len(extracted_non_empty) >= 1

    review_res = run_sync(review_assessment_document(
        created["id"],
        doc["id"],
        DocumentReviewPayload(
            action="ACCEPT_CORRECTIONS",
            acceptedFields=extracted_non_empty,
            reviewNotes="Reviewed against signed clinic summary",
            verifyAccepted=False
        ),
        owner
    ))
    reviewed_doc = review_res["document"]
    reviewed_asm = review_res["assessment"]

    assert reviewed_doc["reviewStatus"] == "ACCEPTED"
    assert reviewed_doc["verificationStatus"] == "ACCEPTED_UNVERIFIED"
    for fk in extracted_non_empty:
        assert reviewed_asm["underwritingData"][fk] == doc["extractedFields"][fk]

    # Risk score still unchanged
    assert reviewed_asm["combinedScore"] == orig_combined
    assert len(CAPTURED_AUDITS) >= 2


def test_upload_rejects_unauthorized_user_and_invalid_extension():
    owner = make_jwt_payload("user-doc-2", "doc2@petrails.in")
    intruder = make_jwt_payload("user-doc-intruder", "intruder@petrails.in")
    created = seed_assessment(owner, asm_id="asm-doc-sec", pet_id="pet-doc-sec")

    with pytest.raises(HTTPException) as exc_403:
        bad_upload = UploadFile(filename="report.png", file=io.BytesIO(b"fake"))
        run_sync(upload_assessment_document(created["id"], bad_upload, intruder))
    assert exc_403.value.status_code == 403

    with pytest.raises(HTTPException) as exc_400:
        bad_ext = UploadFile(filename="malware.exe", file=io.BytesIO(b"MZ"))
        run_sync(upload_assessment_document(created["id"], bad_ext, owner))
    assert exc_400.value.status_code == 400

