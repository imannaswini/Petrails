import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import get_pets_collection, get_assessments_collection, db_instance
from app.core.config import settings
from app.schemas.pet import PetSchema
from app.core.security import get_current_user_payload

logger = logging.getLogger("petrails.pets")
router = APIRouter()

# In-memory store for test suite and offline fallback
TEST_PETS_STORE: Dict[str, Dict[str, Any]] = {}

def pet_actor(token_payload: Any) -> tuple[str, str]:
    if settings.TESTING and not isinstance(token_payload, dict):
        return "test-user", "administrator"
    if not isinstance(token_payload, dict) or not (token_payload.get("sub") or token_payload.get("email")):
        raise HTTPException(status_code=401, detail="Authorization credentials required.")
    return str(token_payload.get("sub") or token_payload.get("email")), str(token_payload.get("role") or "")

def can_access_pet(pet: Dict[str, Any], actor_id: str, role: str) -> bool:
    return role.strip().lower() == "administrator" or pet.get("createdByUserId") == actor_id

def clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip MongoDB internal _id identifier."""
    doc_copy = dict(doc)
    doc_copy.pop("_id", None)
    return doc_copy

@router.get("", response_model=List[Dict[str, Any]])
async def list_pets(token_payload: Dict[str, Any] = Depends(get_current_user_payload)):
    """Retrieve all pet profiles from MongoDB Atlas."""
    actor_id, role = pet_actor(token_payload)
    if settings.TESTING or not db_instance.is_connected:
        return [p for p in TEST_PETS_STORE.values() if can_access_pet(p, actor_id, role)]

    pets_coll = get_pets_collection()
    query = {} if role.strip().lower() == "administrator" else {"createdByUserId": actor_id}
    cursor = pets_coll.find(query)
    pets = []
    async for pet in cursor:
        pets.append(clean_doc(dict(pet)))
    return pets

@router.get("/{pet_id}", response_model=Dict[str, Any])
async def get_pet(pet_id: str, token_payload: Dict[str, Any] = Depends(get_current_user_payload)):
    """Retrieve a single pet profile by unique identifier."""
    actor_id, role = pet_actor(token_payload)
    if settings.TESTING or not db_instance.is_connected:
        if pet_id in TEST_PETS_STORE:
            pet = TEST_PETS_STORE[pet_id]
            if not can_access_pet(pet, actor_id, role):
                raise HTTPException(status_code=403, detail="Access denied to this pet record.")
            return pet
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pet record '{pet_id}' not found."
        )

    pets_coll = get_pets_collection()
    pet = await pets_coll.find_one({"id": pet_id})
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pet record '{pet_id}' not found."
        )
    cleaned = clean_doc(dict(pet))
    if not can_access_pet(cleaned, actor_id, role):
        raise HTTPException(status_code=403, detail="Access denied to this pet record.")
    return cleaned

@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_or_update_pet(payload: PetSchema, token_payload: Dict[str, Any] = Depends(get_current_user_payload)):
    """Create or update a pet profile in MongoDB Atlas."""
    actor_id, role = pet_actor(token_payload)
    pet_data = payload.model_dump()
    pet_data["createdByUserId"] = actor_id

    if settings.TESTING or not db_instance.is_connected:
        existing = TEST_PETS_STORE.get(payload.id)
        if existing and not can_access_pet(existing, actor_id, role):
            raise HTTPException(status_code=403, detail="Access denied to update this pet record.")
        TEST_PETS_STORE[payload.id] = pet_data
        return pet_data

    pets_coll = get_pets_collection()
    existing = await pets_coll.find_one({"id": payload.id})
    if existing and not can_access_pet(existing, actor_id, role):
        raise HTTPException(status_code=403, detail="Access denied to update this pet record.")
    await pets_coll.update_one(
        {"id": payload.id},
        {"$set": pet_data},
        upsert=True
    )
    saved = await pets_coll.find_one({"id": payload.id})
    return clean_doc(dict(saved))

@router.delete("/{pet_id}", status_code=status.HTTP_200_OK)
async def delete_pet(pet_id: str, token_payload: Dict[str, Any] = Depends(get_current_user_payload)):
    """Remove a pet profile from MongoDB Atlas."""
    actor_id, role = pet_actor(token_payload)
    if settings.TESTING or not db_instance.is_connected:
        if pet_id in TEST_PETS_STORE:
            if not can_access_pet(TEST_PETS_STORE[pet_id], actor_id, role):
                raise HTTPException(status_code=403, detail="Access denied to delete this pet record.")
            from app.api.routes_assessments import TEST_ASSESSMENTS_STORE
            if any(a.get("petId") == pet_id for a in TEST_ASSESSMENTS_STORE.values()):
                raise HTTPException(status_code=409, detail="Pet has linked assessments and cannot be deleted.")
            del TEST_PETS_STORE[pet_id]
            return {"success": True, "message": f"Pet '{pet_id}' deleted."}
        raise HTTPException(status_code=404, detail=f"Pet '{pet_id}' not found.")

    pets_coll = get_pets_collection()
    existing = await pets_coll.find_one({"id": pet_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Pet '{pet_id}' not found.")
    if not can_access_pet(dict(existing), actor_id, role):
        raise HTTPException(status_code=403, detail="Access denied to delete this pet record.")
    assessments_coll = get_assessments_collection()
    if await assessments_coll.find_one({"petId": pet_id}):
        raise HTTPException(status_code=409, detail="Pet has linked assessments and cannot be deleted.")
    res = await pets_coll.delete_one({"id": pet_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Pet '{pet_id}' not found.")
    return {"success": True, "message": f"Pet '{pet_id}' deleted."}

