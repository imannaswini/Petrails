import os
import sys
import pytest
from fastapi import HTTPException

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.schemas.pet import (
    PetSchema,
    MedicalRecordSchema,
    VaccinationRecordSchema,
    PolicySummarySchema
)
from app.api.routes_pets import list_pets, get_pet, create_or_update_pet, delete_pet, TEST_PETS_STORE

def run_sync(coro):
    """Execute a test coroutine synchronously without event loop overhead."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

@pytest.fixture(autouse=True)
def clean_store():
    """Ensure clean store for each test."""
    TEST_PETS_STORE.clear()

def test_pet_schema_validation():
    """Verify PetSchema validation with actuarial and clinical fields."""
    pet = PetSchema(
        id="pet-test-01",
        name="Simba",
        species="Dog",
        breed="Golden Retriever",
        age=4,
        ageUnit="years",
        sex="Male",
        weightKg=29.5,
        policyId="POL-TEST-001",
        ownerName="Rahul Roy",
        registeredVetClinic="Cessna Lifeline",
        medicalHistory=[
            MedicalRecordSchema(
                id="med-1",
                date="2026-05-10",
                event="Annual Health Check",
                diagnosis="Healthy",
                treatment="Preventive care",
                outcome="Normal",
                clinicName="Cessna Lifeline",
                veterinarian="Dr. Aditi"
            )
        ],
        vaccinations=[
            VaccinationRecordSchema(
                id="vac-1",
                vaccineName="Rabies",
                administeredDate="2026-01-15",
                nextDueDate="2027-01-15",
                batchNumber="RB-2026-99"
            )
        ],
        policies=[
            PolicySummarySchema(
                id="pol-1",
                policyNumber="POL-TEST-001",
                startDate="2026-01-01",
                renewalDate="2027-01-01"
            )
        ]
    )
    assert pet.id == "pet-test-01"
    assert pet.name == "Simba"
    assert pet.riskScore == 50
    assert len(pet.medicalHistory) == 1
    assert len(pet.vaccinations) == 1

def test_pet_lifecycle_crud():
    """Verify pet creation, retrieval, listing, and deletion."""
    pet_payload = PetSchema(
        id="pet-test-02",
        name="Luna",
        species="Cat",
        breed="Persian",
        age=3,
        ageUnit="years",
        sex="Female",
        weightKg=4.2,
        policyId="POL-TEST-002",
        ownerName="Priya Sharma",
        registeredVetClinic="Crown Vet"
    )
    # 1. Create
    created = run_sync(create_or_update_pet(pet_payload))
    assert created["id"] == "pet-test-02"
    assert created["name"] == "Luna"

    # 2. Retrieve
    retrieved = run_sync(get_pet("pet-test-02"))
    assert retrieved["name"] == "Luna"
    assert retrieved["breed"] == "Persian"

    # 3. List
    all_pets = run_sync(list_pets())
    assert len(all_pets) == 1
    assert all_pets[0]["id"] == "pet-test-02"

    # 4. Delete
    del_res = run_sync(delete_pet("pet-test-02"))
    assert del_res["success"] is True

    # 5. Verify 404 after deletion
    with pytest.raises(HTTPException) as exc_info:
        run_sync(get_pet("pet-test-02"))
    assert exc_info.value.status_code == 404
