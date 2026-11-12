import os
import sys
import pytest
from fastapi import HTTPException

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.api.routes_pets import create_or_update_pet, get_pet, delete_pet, TEST_PETS_STORE
from app.api.routes_assessments import create_assessment, TEST_ASSESSMENTS_STORE
from app.schemas.pet import PetSchema
from app.schemas.assessment import AssessmentSchema
from app.ml.inference import parse_pet_age, ml_engine

ACTOR = {"sub": "workflow-test-user", "email": "workflow@example.test", "role": "Insurance Professional"}

def run_sync(coro):
    try:
        coro.send(None)
    except StopIteration as result:
        return result.value

@pytest.fixture(autouse=True)
def clean_stores():
    TEST_PETS_STORE.clear()
    TEST_ASSESSMENTS_STORE.clear()
    yield
    TEST_PETS_STORE.clear()
    TEST_ASSESSMENTS_STORE.clear()

def test_fractional_age_is_preserved():
    assert parse_pet_age({"ageYears": 0.4}) == 0.4

def test_missing_verified_inputs_are_explicit_fallback():
    _, _, factors = ml_engine.predict_underwriting_risk({
        "ageYears": 0.5, "breed": "Mixed", "species": "Dog", "weightKg": 5,
        "medicalHistory": [], "vaccinations": []
    })
    assert ml_engine.last_inference_metadata["mode"] == "FALLBACK"
    assert set(ml_engine.last_inference_metadata["unknown_inputs"]) == {"vaccination_compliance", "medical_history_count"}
    assert factors == []

def test_pet_assessment_linking_and_rule_analysis_persist():
    pet = PetSchema(
        id="pet-workflow-1", name="Milo", species="Dog", breed="Mixed", age=0.5,
        ageUnit="years", sex="Male", weightKg=4.2, policyId="POL-WF-1", ownerName="Owner"
    )
    saved_pet = run_sync(create_or_update_pet(pet, ACTOR))
    assert saved_pet["createdByUserId"] == ACTOR["sub"]

    payload = AssessmentSchema(
        petId=saved_pet["id"], petName="Milo", breed="Mixed", species="Dog",
        ageText="0.5 years", ageYears=0.5, weightKg=4.2, sex="Male", policyId="POL-WF-1"
    )
    saved = run_sync(create_assessment(payload, ACTOR))
    assert saved["petId"] == saved_pet["id"]
    assert saved["ruleAnalysis"] == []
    assert saved["inferenceMode"] == "FALLBACK"
    assert saved["inferenceUnknownInputs"]
    with pytest.raises(HTTPException) as exc:
        run_sync(delete_pet(saved_pet["id"], ACTOR))
    assert exc.value.status_code == 409

def test_pet_record_is_not_readable_by_another_user():
    pet = PetSchema(
        id="pet-private-1", name="Nori", species="Cat", breed="Domestic", age=2,
        ageUnit="years", sex="Female", weightKg=3.5, policyId="POL-PRIVATE", ownerName="Owner"
    )
    run_sync(create_or_update_pet(pet, ACTOR))
    with pytest.raises(HTTPException) as exc:
        run_sync(get_pet("pet-private-1", {"sub": "another-user", "role": "Insurance Professional"}))
    assert exc.value.status_code == 403
