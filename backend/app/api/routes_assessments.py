import time
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status
from app.core.database import (
    get_assessments_collection,
    get_pets_collection,
    get_information_requests_collection,
    db_instance
)
from app.core.config import settings
from app.schemas.assessment import (
    AssessmentSchema,
    UnderwriterDecisionPayload,
    InformationRequestPayload
)
from app.services.intelligence_service import underwriting_rule_engine, predictive_risk_model
from app.services.audit_service import log_audit_trail

logger = logging.getLogger("petrails.assessments")
router = APIRouter()

# In-memory store for tests and offline mode
TEST_ASSESSMENTS_STORE: Dict[str, Dict[str, Any]] = {}
TEST_INFO_REQUESTS_STORE: Dict[str, Dict[str, Any]] = {}

def clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip MongoDB internal _id identifier."""
    doc_copy = dict(doc)
    doc_copy.pop("_id", None)
    return doc_copy

@router.get("", response_model=List[Dict[str, Any]])
async def list_assessments():
    """Retrieve all risk assessments from MongoDB Atlas."""
    if settings.TESTING or not db_instance.is_connected:
        return list(TEST_ASSESSMENTS_STORE.values())

    assessments_coll = get_assessments_collection()
    cursor = assessments_coll.find({})
    assessments = []
    async for asm in cursor:
        assessments.append(clean_doc(dict(asm)))
    return assessments

@router.get("/{assessment_id}", response_model=Dict[str, Any])
async def get_assessment(assessment_id: str):
    """Retrieve an assessment by unique identifier."""
    if settings.TESTING or not db_instance.is_connected:
        if assessment_id in TEST_ASSESSMENTS_STORE:
            return TEST_ASSESSMENTS_STORE[assessment_id]
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found."
        )

    assessments_coll = get_assessments_collection()
    asm = await assessments_coll.find_one({"id": assessment_id})
    if not asm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found."
        )
    return clean_doc(dict(asm))

@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_assessment(payload: AssessmentSchema):
    """
    Create a new actuarial assessment in MongoDB Atlas.
    Evaluates underwriting rules and predictive ML scoring if needed.
    """
    data = payload.model_dump()

    # If scores are default 50, run intelligence engine evaluation
    if data.get("ruleScore") == 50 and data.get("mlScore") == 50:
        rule_score, _ = underwriting_rule_engine.evaluate_rules(data)
        ml_score, conf, shap_factors = predictive_risk_model.predict_risk({
            **data,
            "rule_score": rule_score
        })
        combined = int(round(rule_score * 0.4 + ml_score * 0.6))
        data["ruleScore"] = rule_score
        data["mlScore"] = ml_score
        data["combinedScore"] = combined
        data["modelConfidence"] = int(conf * 100)
        data["riskLevel"] = "HIGH" if combined >= 70 else "MEDIUM" if combined >= 45 else "LOW"
        if shap_factors and not data.get("contributingFactors"):
            data["contributingFactors"] = [f.model_dump() for f in shap_factors]

    data["lastUpdated"] = "Just now"

    if settings.TESTING or not db_instance.is_connected:
        TEST_ASSESSMENTS_STORE[payload.id] = data
        return data

    assessments_coll = get_assessments_collection()
    await assessments_coll.update_one(
        {"id": payload.id},
        {"$set": data},
        upsert=True
    )
    saved = await assessments_coll.find_one({"id": payload.id})
    return clean_doc(dict(saved))

@router.post("/{assessment_id}/decision")
async def record_underwriter_decision(assessment_id: str, payload: UnderwriterDecisionPayload):
    """Record an underwriter decision into MongoDB Atlas and append to decision audit history."""
    asm: Optional[Dict[str, Any]] = None
    if settings.TESTING or not db_instance.is_connected:
        asm = TEST_ASSESSMENTS_STORE.get(assessment_id)
    else:
        assessments_coll = get_assessments_collection()
        asm = await assessments_coll.find_one({"id": assessment_id})

    if not asm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found."
        )

    actor_user = payload.user or "Sarah Jenkins"
    actor_role = "Senior Underwriting Officer"
    timestamp_str = time.strftime("%Y-%m-%d %H:%M IST")

    new_history_entry = {
        "id": f"dh-{int(time.time() * 1000)}",
        "action": payload.decision,
        "user": actor_user,
        "role": actor_role,
        "timestamp": timestamp_str,
        "notes": payload.notes or f"Underwriter recorded: {payload.decision}.",
        "ruleScoreAtTime": asm.get("ruleScore", 58),
        "mlScoreAtTime": asm.get("mlScore", 67)
    }

    updated_status = (
        "Approved" if payload.decision == "Approve"
        else "Information Requested" if payload.decision == "Request Information"
        else "Referred"
    )

    current_decision = asm.get("underwriterDecision") or {}
    current_stipulations = list(current_decision.get("stipulations") or [])
    if payload.stipulation and payload.stipulation not in current_stipulations:
        current_stipulations.append(payload.stipulation)

    updated_decision_block = {
        "recommendation": asm.get("riskLevel", "MEDIUM"),
        "selectedDecision": payload.decision,
        "underwriterNotes": payload.notes,
        "stipulations": current_stipulations,
        "lastModifiedBy": actor_user,
        "lastModifiedAt": "Just now"
    }

    if settings.TESTING or not db_instance.is_connected:
        asm["status"] = updated_status
        asm["lastUpdated"] = "Just now"
        asm["underwriterDecision"] = updated_decision_block
        history = asm.get("decisionHistory") or []
        asm["decisionHistory"] = [new_history_entry] + history
        TEST_ASSESSMENTS_STORE[assessment_id] = asm
    else:
        assessments_coll = get_assessments_collection()
        await assessments_coll.update_one(
            {"id": assessment_id},
            {
                "$set": {
                    "status": updated_status,
                    "lastUpdated": "Just now",
                    "underwriterDecision": updated_decision_block
                },
                "$push": {
                    "decisionHistory": {
                        "$each": [new_history_entry],
                        "$position": 0
                    }
                }
            }
        )

        # If approved, update pet policy status in pets collection
        if payload.decision == "Approve" and asm.get("petId"):
            pets_coll = get_pets_collection()
            await pets_coll.update_one(
                {"id": asm["petId"]},
                {"$set": {"policyStatus": "Active"}}
            )

    # Log to audit collection
    await log_audit_trail(
        entity_type="assessment",
        entity_id=assessment_id,
        action=f"Underwriter Decision: {payload.decision}",
        actor_name=actor_user,
        actor_role=actor_role,
        details={
            "decision": payload.decision,
            "stipulation": payload.stipulation,
            "ruleScore": asm.get("ruleScore"),
            "mlScore": asm.get("mlScore")
        },
        notes=payload.notes
    )

    return {"success": True, "decision": new_history_entry}

@router.post("/{assessment_id}/information-request")
async def request_information(assessment_id: str, payload: InformationRequestPayload):
    """Dispatch questionnaire and record information gap update."""
    asm: Optional[Dict[str, Any]] = None
    if settings.TESTING or not db_instance.is_connected:
        asm = TEST_ASSESSMENTS_STORE.get(assessment_id)
    else:
        assessments_coll = get_assessments_collection()
        asm = await assessments_coll.find_one({"id": assessment_id})

    if not asm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found."
        )

    request_id = f"ir-{int(time.time() * 1000)}"
    request_doc = {
        "id": request_id,
        "assessmentId": assessment_id,
        "gapTitle": payload.gapTitle,
        "recipient": payload.recipient,
        "urgency": payload.urgency,
        "questions": payload.questions,
        "createdAt": time.strftime("%Y-%m-%d %H:%M:%S IST"),
        "status": "DISPATCHED"
    }

    if settings.TESTING or not db_instance.is_connected:
        TEST_INFO_REQUESTS_STORE[request_id] = request_doc
        if payload.gapTitle and "informationGaps" in asm:
            for g in asm["informationGaps"]:
                if g.get("title") == payload.gapTitle:
                    g["status"] = "Requested"
                    g["requestedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
            asm["status"] = "Information Requested"
            TEST_ASSESSMENTS_STORE[assessment_id] = asm
    else:
        info_coll = get_information_requests_collection()
        await info_coll.insert_one(request_doc)

        if payload.gapTitle and "informationGaps" in asm:
            gaps = asm["informationGaps"]
            for g in gaps:
                if g.get("title") == payload.gapTitle:
                    g["status"] = "Requested"
                    g["requestedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
            assessments_coll = get_assessments_collection()
            await assessments_coll.update_one(
                {"id": assessment_id},
                {"$set": {"informationGaps": gaps, "status": "Information Requested"}}
            )

    await log_audit_trail(
        entity_type="information_request",
        entity_id=request_id,
        action=f"Dispatched Information Request to {payload.recipient}",
        actor_name="Sarah Jenkins",
        actor_role="Senior Underwriting Officer",
        details=request_doc,
        notes=f"Questions: {len(payload.questions)}"
    )

    return {
        "success": True,
        "message": f"Questionnaire dispatched to {payload.recipient}",
        "dispatchedAt": time.strftime("%Y-%m-%d %H:%M:%S UTC")
    }

