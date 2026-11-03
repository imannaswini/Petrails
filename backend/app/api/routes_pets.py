import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from app.core.database import get_pets_collection, db_instance
from app.core.config import settings
from app.schemas.pet import PetSchema

logger = logging.getLogger("petrails.pets")
router = APIRouter()

# In-memory store for test suite and offline fallback
TEST_PETS_STORE: Dict[str, Dict[str, Any]] = {}

def clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip MongoDB internal _id identifier."""
    doc_copy = dict(doc)
    doc_copy.pop("_id", None)
    return doc_copy

@router.get("", response_model=List[Dict[str, Any]])
async def list_pets():
    """Retrieve all pet profiles from MongoDB Atlas."""
    if settings.TESTING or not db_instance.is_connected:
        return list(TEST_PETS_STORE.values())

    pets_coll = get_pets_collection()
    cursor = pets_coll.find({})
    pets = []
    async for pet in cursor:
        pets.append(clean_doc(dict(pet)))
    return pets

@router.get("/{pet_id}", response_model=Dict[str, Any])
async def get_pet(pet_id: str):
    """Retrieve a single pet profile by unique identifier."""
    if settings.TESTING or not db_instance.is_connected:
        if pet_id in TEST_PETS_STORE:
            return TEST_PETS_STORE[pet_id]
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
    return clean_doc(dict(pet))

@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_or_update_pet(payload: PetSchema):
    """Create or update a pet profile in MongoDB Atlas."""
    pet_data = payload.model_dump()

    if settings.TESTING or not db_instance.is_connected:
        TEST_PETS_STORE[payload.id] = pet_data
        return pet_data

    pets_coll = get_pets_collection()
    await pets_coll.update_one(
        {"id": payload.id},
        {"$set": pet_data},
        upsert=True
    )
    saved = await pets_coll.find_one({"id": payload.id})
    return clean_doc(dict(saved))

@router.delete("/{pet_id}", status_code=status.HTTP_200_OK)
async def delete_pet(pet_id: str):
    """Remove a pet profile from MongoDB Atlas."""
    if settings.TESTING or not db_instance.is_connected:
        if pet_id in TEST_PETS_STORE:
            del TEST_PETS_STORE[pet_id]
            return {"success": True, "message": f"Pet '{pet_id}' deleted."}
        raise HTTPException(status_code=404, detail=f"Pet '{pet_id}' not found.")

    pets_coll = get_pets_collection()
    res = await pets_coll.delete_one({"id": pet_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Pet '{pet_id}' not found.")
    return {"success": True, "message": f"Pet '{pet_id}' deleted."}

