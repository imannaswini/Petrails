import time
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from app.core.database import get_claims_collection, db_instance
from app.core.config import settings
from app.schemas.claim import ClaimSchema, ClaimDecisionPayload
from app.services.intelligence_service import claims_anomaly_engine
from app.services.audit_service import log_audit_trail

logger = logging.getLogger("petrails.claims")
router = APIRouter()

# In-memory store for tests and offline mode
TEST_CLAIMS_STORE: Dict[str, Dict[str, Any]] = {}

def clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip MongoDB internal _id identifier."""
    doc_copy = dict(doc)
    doc_copy.pop("_id", None)
    return doc_copy

@router.get("", response_model=List[Dict[str, Any]])
async def list_claims():
    """Retrieve all pet claims from MongoDB Atlas."""
    if settings.TESTING or not db_instance.is_connected:
        return list(TEST_CLAIMS_STORE.values())

    claims_coll = get_claims_collection()
    cursor = claims_coll.find({})
    claims = []
    async for claim in cursor:
        claims.append(clean_doc(dict(claim)))
    return claims

@router.get("/{claim_id}", response_model=Dict[str, Any])
async def get_claim(claim_id: str):
    """Retrieve a single claim by unique identifier."""
    if settings.TESTING or not db_instance.is_connected:
        if claim_id in TEST_CLAIMS_STORE:
            return TEST_CLAIMS_STORE[claim_id]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Claim '{claim_id}' not found."
        )

    claims_coll = get_claims_collection()
    claim = await claims_coll.find_one({"id": claim_id})
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Claim '{claim_id}' not found."
        )
    return clean_doc(dict(claim))

@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_claim(payload: ClaimSchema):
    """Create a new insurance claim and evaluate anomaly indicators."""
    data = payload.model_dump()

    # Evaluate anomaly indicators if default
    if not data.get("indicators"):
        score, level, indicators = claims_anomaly_engine.evaluate_claim(data)
        data["anomalyScore"] = score
        data["anomalyLevel"] = level
        data["indicators"] = [i.model_dump() for i in indicators]

    if settings.TESTING or not db_instance.is_connected:
        TEST_CLAIMS_STORE[payload.id] = data
        return data

    claims_coll = get_claims_collection()
    await claims_coll.update_one(
        {"id": payload.id},
        {"$set": data},
        upsert=True
    )

    saved = await claims_coll.find_one({"id": payload.id})
    return clean_doc(dict(saved))

@router.post("/{claim_id}/decision")
async def record_claim_decision(claim_id: str, payload: ClaimDecisionPayload):
    """Record a claims adjuster decision and persist to audit trail."""
    claim: Optional[Dict[str, Any]] = None
    if settings.TESTING or not db_instance.is_connected:
        claim = TEST_CLAIMS_STORE.get(claim_id)
    else:
        claims_coll = get_claims_collection()
        claim = await claims_coll.find_one({"id": claim_id})

    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Claim '{claim_id}' not found."
        )

    actor_name = payload.decidedBy or "Sarah Jenkins (Senior Underwriting & Claims Officer)"
    timestamp_str = time.strftime("%Y-%m-%d %H:%M IST")

    approved_amount = payload.approvedAmountInr
    if approved_amount is None:
        approved_amount = round(claim.get("amountInr", 0) * 0.9, 2) if "Approve" in payload.status else 0.0

    decision_entry = {
        "status": payload.status,
        "approvedAmountInr": approved_amount,
        "notes": payload.notes or f"Adjuster status: {payload.status}",
        "decidedBy": actor_name,
        "timestamp": timestamp_str
    }

    final_status = (
        "Approved" if payload.status in ["Approved", "Adjusted"]
        else "Under Review" if payload.status == "Information Requested"
        else "Attention Required"
    )

    if settings.TESTING or not db_instance.is_connected:
        claim["status"] = final_status
        claim["adjusterDecision"] = decision_entry
        TEST_CLAIMS_STORE[claim_id] = claim
    else:
        claims_coll = get_claims_collection()
        await claims_coll.update_one(
            {"id": claim_id},
            {
                "$set": {
                    "status": final_status,
                    "adjusterDecision": decision_entry
                }
            }
        )

    await log_audit_trail(
        entity_type="claim",
        entity_id=claim_id,
        action=f"Claim Adjuster Decision: {payload.status}",
        actor_name=actor_name,
        actor_role="Claims Adjuster",
        details={
            "status": payload.status,
            "approvedAmountInr": approved_amount,
            "claimAmount": claim.get("amountInr")
        },
        notes=payload.notes
    )

    return {"success": True, "decision": decision_entry}

