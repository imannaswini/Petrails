import uuid
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from app.core.database import get_users_collection, db_instance
from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_payload,
    get_optional_user_payload
)
from app.schemas.auth import LoginRequest, RegisterRequest, AuthResponse, UserResponse

logger = logging.getLogger("petrails.auth")
router = APIRouter()

def clean_mongo_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip internal MongoDB identifiers and sensitive password hashes."""
    doc_copy = dict(doc)
    doc_copy.pop("_id", None)
    doc_copy.pop("hashedPassword", None)
    return doc_copy

DEFAULT_SEED_USERS = {
    "sarah.jenkins@petrails.insure": {
        "id": "usr-1",
        "fullName": "Sarah Jenkins",
        "email": "sarah.jenkins@petrails.insure",
        "role": "Senior Underwriting Officer",
        "authorityLimitInr": 500000,
        "organization": "Tata AIG General Insurance"
    },
    "rajesh.gupta@petrails.insure": {
        "id": "usr-2",
        "fullName": "Rajesh Gupta",
        "email": "rajesh.gupta@petrails.insure",
        "role": "Senior Claims Adjuster",
        "authorityLimitInr": 400000,
        "organization": "Tata AIG General Insurance"
    }
}

# In-memory test store
TEST_USERS_STORE: Dict[str, Any] = {}

@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email_clean = payload.email.lower()
    
    if settings.TESTING or not db_instance.is_connected:
        user_record = TEST_USERS_STORE.get(email_clean)
        if not user_record and email_clean in DEFAULT_SEED_USERS:
            seed = DEFAULT_SEED_USERS[email_clean]
            user_record = {
                **seed,
                "hashedPassword": hash_password("Petrails@2026")
            }
        
        if not user_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials. Please verify your email and password."
            )
        
        if payload.password and user_record.get("hashedPassword"):
            if not verify_password(payload.password, user_record["hashedPassword"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials. Please verify your email and password."
                )

        token = create_access_token({
            "sub": user_record["id"],
            "email": user_record["email"],
            "role": user_record["role"]
        })
        return AuthResponse(token=token, user=UserResponse(**clean_mongo_user(user_record)))

    users_coll = get_users_collection()
    user = await users_coll.find_one({"email": email_clean})

    if user:
        # Check password hash with bcrypt
        if payload.password and user.get("hashedPassword"):
            if not verify_password(payload.password, user["hashedPassword"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials. Please verify your email and password."
                )
    else:
        # If user is in default seed set, bootstrap into MongoDB
        if email_clean in DEFAULT_SEED_USERS:
            seed_info = DEFAULT_SEED_USERS[email_clean]
            user = {
                **seed_info,
                "hashedPassword": hash_password(payload.password or "Petrails@2026")
            }
            await users_coll.insert_one(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found. Please register."
            )

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user.get("role", "Underwriter")
    })

    return AuthResponse(
        token=token,
        user=UserResponse(**clean_mongo_user(user))
    )

@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest):
    email_clean = payload.workEmail.lower()

    tier_limits = {
        "tier-1": 250000,
        "tier-2": 500000,
        "tier-3": 1000000,
        "tier-4": 2500000
    }
    limit = tier_limits.get(payload.authorityTier.lower(), 500000)
    user_id = f"usr-{uuid.uuid4().hex[:8]}"

    user_doc = {
        "id": user_id,
        "fullName": payload.fullName,
        "email": email_clean,
        "role": payload.role,
        "authorityLimitInr": limit,
        "organization": payload.organization,
        "hashedPassword": hash_password(payload.password or "Petrails@2026")
    }

    if settings.TESTING or not db_instance.is_connected:
        if email_clean in TEST_USERS_STORE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address is already registered."
            )
        TEST_USERS_STORE[email_clean] = user_doc
    else:
        users_coll = get_users_collection()
        existing = await users_coll.find_one({"email": email_clean})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address is already registered."
            )
        await users_coll.insert_one(user_doc)

    token = create_access_token({
        "sub": user_id,
        "email": user_doc["email"],
        "role": user_doc["role"]
    })

    return AuthResponse(
        token=token,
        user=UserResponse(**clean_mongo_user(user_doc))
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(token_payload: Optional[Dict[str, Any]] = Depends(get_optional_user_payload)):
    if token_payload and token_payload.get("sub"):
        user_id = token_payload["sub"]
        if settings.TESTING or not db_instance.is_connected:
            for u in TEST_USERS_STORE.values():
                if u.get("id") == user_id or u.get("email") == token_payload.get("email"):
                    return UserResponse(**clean_mongo_user(u))
        else:
            users_coll = get_users_collection()
            user = await users_coll.find_one({"id": user_id})
            if user:
                return UserResponse(**clean_mongo_user(user))
        
        return UserResponse(
            id=user_id,
            fullName=token_payload.get("email", "User").split("@")[0].replace(".", " ").title(),
            email=token_payload.get("email", "user@petrails.insure"),
            role=token_payload.get("role", "Underwriter"),
            authorityLimitInr=500000,
            organization="Tata AIG General Insurance"
        )

    # Fallback to default lead underwriter
    return UserResponse(
        id="usr-1",
        fullName="Sarah Jenkins",
        email="sarah.jenkins@petrails.insure",
        role="Senior Underwriting Officer",
        authorityLimitInr=500000,
        organization="Tata AIG General Insurance"
    )
