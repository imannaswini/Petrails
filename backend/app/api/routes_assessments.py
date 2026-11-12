import os
import time
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from app.core.database import (
    get_assessments_collection,
    get_pets_collection,
    get_information_requests_collection,
    get_users_collection,
    db_instance
)
from app.core.config import settings
from app.core.security import get_current_user_payload, AUTHORITY_TIER_LIMITS
from app.schemas.assessment import (
    AssessmentSchema,
    AssessmentUpdatePayload,
    UnderwriterDecisionPayload,
    InformationRequestPayload,
    DocumentReviewPayload
)
from app.services.intelligence_service import underwriting_rule_engine, predictive_risk_model
from app.services.document_intelligence_service import (
    ALLOWED_EXTENSIONS,
    MAX_DOCUMENT_BYTES,
    analyze_veterinary_document
)
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

def _normalize_authority_tier(raw_tier: Optional[str]) -> str:
    """Normalize JWT authorityTier claim, failing closed to tier-1 if missing/unknown."""
    tier_clean = (raw_tier or "").strip().lower()
    if "tier-4" in tier_clean or "tier 4" in tier_clean:
        return "tier-4"
    if "tier-3" in tier_clean or "tier 3" in tier_clean:
        return "tier-3"
    if "tier-2" in tier_clean or "tier 2" in tier_clean:
        return "tier-2"
    if "tier-1" in tier_clean or "tier 1" in tier_clean:
        return "tier-1"
    return "tier-1"

async def resolve_authenticated_actor(token_payload: Any) -> Dict[str, Any]:
    """
    Validate verified JWT payload and derive user identity, role, authorityTier,
    and authorityLimitInr strictly server-side (never trusting request body fields).
    """
    if not isinstance(token_payload, dict) or not (token_payload.get("sub") or token_payload.get("email")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization credentials required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = str(token_payload.get("sub") or "").strip()
    email = str(token_payload.get("email") or "").strip().lower()
    actor_role = str(token_payload.get("role") or "").strip() or "Insurance Professional"
    authority_tier = _normalize_authority_tier(token_payload.get("authorityTier"))

    raw_limit = token_payload.get("authorityLimitInr")
    authority_limit_inr: Optional[int] = None
    if raw_limit is not None:
        try:
            parsed_limit = int(float(raw_limit))
            if parsed_limit > 0:
                authority_limit_inr = parsed_limit
        except (TypeError, ValueError):
            authority_limit_inr = None
    if authority_limit_inr is None:
        authority_limit_inr = AUTHORITY_TIER_LIMITS.get(authority_tier, AUTHORITY_TIER_LIMITS["tier-1"])

    actor_name = str(token_payload.get("fullName") or token_payload.get("name") or "").strip()
    if not actor_name:
        if not (settings.TESTING or not db_instance.is_connected):
            users_coll = get_users_collection()
            query = {"id": user_id} if user_id else {"email": email}
            user_doc = await users_coll.find_one(query)
            if not user_doc and email and user_id:
                user_doc = await users_coll.find_one({"email": email})
            if user_doc and user_doc.get("fullName"):
                actor_name = str(user_doc["fullName"]).strip()
        else:
            from app.api.routes_auth import TEST_USERS_STORE, DEFAULT_SEED_USERS
            user_doc = TEST_USERS_STORE.get(email) if email else None
            if not user_doc and user_id:
                user_doc = next((u for u in TEST_USERS_STORE.values() if u.get("id") == user_id), None)
            if not user_doc and email in DEFAULT_SEED_USERS:
                user_doc = DEFAULT_SEED_USERS[email]
            if user_doc and user_doc.get("fullName"):
                actor_name = str(user_doc["fullName"]).strip()

    if not actor_name:
        if email and "@" in email:
            actor_name = email.split("@", 1)[0].replace(".", " ").replace("_", " ").title()
        else:
            actor_name = user_id

    return {
        "id": user_id,
        "email": email,
        "name": actor_name,
        "role": actor_role,
        "authorityTier": authority_tier,
        "authorityLimitInr": authority_limit_inr,
    }

async def get_linked_policy_coverage_limit(asm: Dict[str, Any]) -> Optional[float]:
    """Retrieve annualCoverageLimit for the policy linked to an assessment."""
    pet_id = asm.get("petId")
    policy_id = asm.get("policyId")
    pet_doc: Optional[Dict[str, Any]] = None

    if pet_id:
        if settings.TESTING or not db_instance.is_connected:
            from app.api.routes_pets import TEST_PETS_STORE
            pet_doc = TEST_PETS_STORE.get(pet_id)
        else:
            pets_coll = get_pets_collection()
            pet_doc = await pets_coll.find_one({"id": pet_id})

    if pet_doc and isinstance(pet_doc.get("policies"), list) and pet_doc["policies"]:
        policies = pet_doc["policies"]
        matched = next(
            (p for p in policies if isinstance(p, dict) and p.get("policyNumber") == policy_id),
            None
        )
        target_policy = matched or (policies[0] if isinstance(policies[0], dict) else None)
        if target_policy and target_policy.get("annualCoverageLimit") is not None:
            try:
                return float(target_policy["annualCoverageLimit"])
            except (TypeError, ValueError):
                pass

    if asm.get("annualCoverageLimit") is not None:
        try:
            return float(asm["annualCoverageLimit"])
        except (TypeError, ValueError):
            pass

    return None

def utc_now_iso() -> str:
    """Return current UTC timestamp formatted as strict ISO 8601."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def build_assessment_access_query(actor: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build MongoDB filter enforcing user isolation, role-based oversight,
    and exclusion of soft-deleted/archived or demo seed records.
    """
    active_filter = [
        {"isDemoSeed": {"$ne": True}},
        {"isDeleted": {"$ne": True}},
        {"status": {"$ne": "Archived"}}
    ]
    role_lower = (actor.get("role") or "").strip().lower()
    if role_lower == "administrator":
        return {"$and": active_filter}

    owner_clauses: List[Dict[str, Any]] = []
    if actor.get("id"):
        owner_clauses.append({"createdByUserId": actor["id"]})
        owner_clauses.append({"authorizedUserIds": actor["id"]})
    if actor.get("email"):
        owner_clauses.append({"createdByEmail": actor["email"]})
    if role_lower == "senior underwriting officer":
        owner_clauses.append({
            "status": "Referred",
            "createdByUserId": {"$exists": True, "$ne": None}
        })

    if not owner_clauses:
        return {"id": "__unauthorized__"}

    return {
        "$and": [
            *active_filter,
            {"$or": owner_clauses}
        ]
    }

def is_authorized_for_assessment(asm: Dict[str, Any], actor: Dict[str, Any]) -> bool:
    """Enforce assessment-level ownership and role authorization."""
    if not asm or asm.get("isDemoSeed") is True:
        return False

    role_lower = (actor.get("role") or "").strip().lower()
    if role_lower == "administrator":
        return True

    actor_id = actor.get("id") or ""
    actor_email = (actor.get("email") or "").strip().lower()
    authorized_ids = asm.get("authorizedUserIds") or []

    if actor_id and (asm.get("createdByUserId") == actor_id or actor_id in authorized_ids):
        return True
    if actor_email and (asm.get("createdByEmail") or "").strip().lower() == actor_email:
        return True
    if role_lower == "senior underwriting officer" and asm.get("status") == "Referred" and asm.get("createdByUserId"):
        return True

    return False

def _is_assessment_archived(asm: Dict[str, Any]) -> bool:
    return bool(asm.get("isDeleted")) or asm.get("status") == "Archived"

def _is_owner_or_admin(asm: Dict[str, Any], actor: Dict[str, Any]) -> bool:
    role_lower = (actor.get("role") or "").strip().lower()
    if role_lower == "administrator":
        return True
    actor_id = actor.get("id") or ""
    actor_email = (actor.get("email") or "").strip().lower()
    if actor_id and asm.get("createdByUserId") == actor_id:
        return True
    if actor_email and (asm.get("createdByEmail") or "").strip().lower() == actor_email:
        return True
    return False

def _execute_scoring_pipeline(feature_vector: Dict[str, Any]) -> Dict[str, Any]:
    """Run deterministic rule engine + ML RandomForestRegressor + SHAP TreeExplainer."""
    medical_records = feature_vector.get("medicalHistory") or []
    feature_vector["medicalInformationKnown"] = bool(medical_records) and all(
        isinstance(record, dict) and record.get("informationStatus") == "VERIFIED"
        for record in medical_records
    )

    rule_score, rule_analysis = underwriting_rule_engine.evaluate_rules(feature_vector)
    ml_score, conf, shap_factors = predictive_risk_model.predict_risk(feature_vector)
    combined = int(round(rule_score * 0.4 + ml_score * 0.6))
    risk_level = "HIGH" if combined >= 70 else "MEDIUM" if combined >= 45 else "LOW"

    return {
        "ruleScore": rule_score,
        "mlScore": ml_score,
        "combinedScore": combined,
        "modelConfidence": int(round(conf * 100)) if conf <= 1.0 else int(round(conf)),
        "riskLevel": risk_level,
        "contributingFactors": [f.model_dump() for f in shap_factors],
        "ruleAnalysis": rule_analysis,
        "inferenceMode": getattr(predictive_risk_model, "last_inference_mode", "UNAVAILABLE"),
        "modelVersion": getattr(predictive_risk_model, "last_model_version", None),
        "shapBaseValue": getattr(predictive_risk_model, "last_shap_base_value", None),
        "modelAvailable": getattr(predictive_risk_model, "last_model_available", False),
        "inferenceUnknownInputs": getattr(predictive_risk_model, "last_unknown_inputs", []),
        "dataCompleteness": None,
    }

@router.get("", response_model=List[Dict[str, Any]])
async def list_assessments(token_payload: Dict[str, Any] = Depends(get_current_user_payload)):
    """Retrieve active assessments authorized for the authenticated user, sorted by latest update."""
    actor = await resolve_authenticated_actor(token_payload)

    if settings.TESTING or not db_instance.is_connected:
        authorized = [
            dict(asm) for asm in TEST_ASSESSMENTS_STORE.values()
            if not _is_assessment_archived(asm) and is_authorized_for_assessment(asm, actor)
        ]
        authorized.sort(
            key=lambda a: str(a.get("updatedAt") or a.get("createdAt") or ""),
            reverse=True
        )
        return authorized

    assessments_coll = get_assessments_collection()
    access_query = build_assessment_access_query(actor)
    cursor = assessments_coll.find(access_query).sort([("updatedAt", -1), ("createdAt", -1)])
    assessments = []
    async for asm in cursor:
        assessments.append(clean_doc(dict(asm)))
    return assessments

@router.get("/{assessment_id}", response_model=Dict[str, Any])
async def get_assessment(
    assessment_id: str,
    token_payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    """Retrieve a single authorized assessment by unique identifier."""
    actor = await resolve_authenticated_actor(token_payload)

    if settings.TESTING or not db_instance.is_connected:
        asm = TEST_ASSESSMENTS_STORE.get(assessment_id)
        if not asm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Assessment '{assessment_id}' not found."
            )
        if not is_authorized_for_assessment(asm, actor):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not authorized to view this assessment."
            )
        if _is_assessment_archived(asm):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail=f"Assessment '{assessment_id}' has been archived and is no longer active."
            )
        return dict(asm)

    assessments_coll = get_assessments_collection()
    asm = await assessments_coll.find_one({"id": assessment_id})
    if not asm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' not found."
        )
    cleaned = clean_doc(dict(asm))
    if not is_authorized_for_assessment(cleaned, actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not authorized to view this assessment."
        )
    if _is_assessment_archived(cleaned):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"Assessment '{assessment_id}' has been archived and is no longer active."
        )
    return cleaned

@router.post("", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_assessment(
    payload: AssessmentSchema,
    token_payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    """
    Create a new actuarial assessment in MongoDB Atlas.
    Generates backend ID and UTC ISO 8601 timestamps, binds verified JWT ownership,
    and executes deterministic rules + RandomForestRegressor + SHAP TreeExplainer.
    """
    actor = await resolve_authenticated_actor(token_payload)
    data = payload.model_dump()

    # Strip untrusted client identifiers/ownership/timestamps
    data.pop("_id", None)
    requested_id = (data.get("id") or "").strip()
    asm_id = requested_id if requested_id else f"asm-{uuid.uuid4().hex[:10]}"

    # Prevent overwriting an existing assessment on POST
    if settings.TESTING or not db_instance.is_connected:
        if asm_id in TEST_ASSESSMENTS_STORE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Assessment '{asm_id}' already exists."
            )
    else:
        assessments_coll = get_assessments_collection()
        if await assessments_coll.find_one({"id": asm_id}):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Assessment '{asm_id}' already exists."
            )

    # Enrich feature vector with linked pet clinical data if available
    feature_vector = dict(data)
    # Use the validated numeric age consistently for rules and model inference.
    if data.get("ageYears") is not None:
        feature_vector["age"] = data["ageYears"]
    pet_doc = None
    if not (settings.TESTING or not db_instance.is_connected):
        pets_coll = get_pets_collection()
        pet_doc = await pets_coll.find_one({"id": payload.petId})
    else:
        from app.api.routes_pets import TEST_PETS_STORE
        pet_doc = TEST_PETS_STORE.get(payload.petId)

    if not pet_doc and not settings.TESTING:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Linked pet '{payload.petId}' must be saved before assessment creation.")
    pet_owner_id = pet_doc.get("createdByUserId") if pet_doc else None
    if not settings.TESTING and actor.get("role", "").strip().lower() != "administrator" and pet_owner_id != actor.get("id"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The linked pet is not accessible to this user.")

    if pet_doc:
        if not feature_vector.get("weightKg"):
            feature_vector["weightKg"] = pet_doc.get("weightKg")
        if not feature_vector.get("medicalHistory"):
            feature_vector["medicalHistory"] = pet_doc.get("medicalHistory", [])
        if not feature_vector.get("vaccinations"):
            feature_vector["vaccinations"] = pet_doc.get("vaccinations", [])
        if not feature_vector.get("age") and pet_doc.get("age") is not None:
            feature_vector["age"] = pet_doc.get("age")
        if feature_vector.get("ageYears") is None and pet_doc.get("age") is not None:
            feature_vector["ageYears"] = pet_doc.get("age")
    medical_records = feature_vector.get("medicalHistory") or []
    feature_vector["medicalInformationKnown"] = bool(medical_records) and all(
        isinstance(record, dict) and record.get("informationStatus") == "VERIFIED"
        for record in medical_records
    )

    # Always execute deterministic Guidewire rule engine
    rule_score, rule_analysis = underwriting_rule_engine.evaluate_rules(feature_vector)

    # Use trained inference only when the artifact and required verified features are available;
    # otherwise the inference service labels its fallback result explicitly.
    ml_score, conf, shap_factors = predictive_risk_model.predict_risk(feature_vector)

    # Actuarial synthesis (40% deterministic rule engine + 60% predictive ML model)
    combined = int(round(rule_score * 0.4 + ml_score * 0.6))
    risk_level = "HIGH" if combined >= 70 else "MEDIUM" if combined >= 45 else "LOW"

    now_iso = utc_now_iso()

    # Overwrite any client-supplied IDs, ownership, scores, timestamps, or SHAP factors
    data["id"] = asm_id
    data["ruleScore"] = rule_score
    data["mlScore"] = ml_score
    data["combinedScore"] = combined
    data["modelConfidence"] = int(round(conf * 100)) if conf <= 1.0 else int(round(conf))
    data["riskLevel"] = risk_level
    data["contributingFactors"] = [f.model_dump() for f in shap_factors]
    data["ruleAnalysis"] = rule_analysis
    data["inferenceMode"] = getattr(predictive_risk_model, "last_inference_mode", "UNAVAILABLE")
    data["modelVersion"] = getattr(predictive_risk_model, "last_model_version", None)
    data["shapBaseValue"] = getattr(predictive_risk_model, "last_shap_base_value", None)
    data["modelAvailable"] = getattr(predictive_risk_model, "last_model_available", False)
    data["inferenceUnknownInputs"] = getattr(predictive_risk_model, "last_unknown_inputs", [])
    data["dataCompleteness"] = None

    gaps = data.get("informationGaps") or []
    data["informationGapsCount"] = len([
        g for g in gaps if isinstance(g, dict) and g.get("status") != "Resolved"
    ])

    data["createdAt"] = now_iso
    data["updatedAt"] = now_iso
    data["lastUpdated"] = now_iso

    data["createdByUserId"] = actor["id"]
    data["createdByEmail"] = actor["email"]
    data["createdByName"] = actor["name"]
    data["createdByRole"] = actor["role"]
    data["authorizedUserIds"] = [actor["id"]] if actor["id"] else []
    data["isDemoSeed"] = False

    if data.get("underwriterDecision"):
        data["underwriterDecision"]["recommendation"] = risk_level

    history_list = data.get("decisionHistory") or []
    for entry in history_list:
        if isinstance(entry, dict):
            if not entry.get("timestamp") or entry.get("timestamp") == "Just now":
                entry["timestamp"] = now_iso
            entry["ruleScoreAtTime"] = rule_score
            entry["mlScoreAtTime"] = ml_score
    data["decisionHistory"] = history_list

    # Synchronize pet riskLevel and riskScore if pet exists
    if not (settings.TESTING or not db_instance.is_connected) and pet_doc:
        pets_coll = get_pets_collection()
        await pets_coll.update_one(
            {"id": payload.petId},
            {"$set": {"riskLevel": risk_level, "riskScore": combined}}
        )

    if settings.TESTING or not db_instance.is_connected:
        TEST_ASSESSMENTS_STORE[asm_id] = data
        saved_doc = dict(data)
    else:
        assessments_coll = get_assessments_collection()
        await assessments_coll.insert_one(dict(data))
        saved = await assessments_coll.find_one({"id": asm_id})
        saved_doc = clean_doc(dict(saved))

    await log_audit_trail(
        entity_type="assessment",
        entity_id=asm_id,
        action="Assessment Created",
        actor_name=actor["name"],
        actor_role=actor["role"],
        details={
            "petId": payload.petId,
            "policyId": payload.policyId,
            "ruleScore": rule_score,
            "mlScore": ml_score,
            "combinedScore": combined,
            "riskLevel": risk_level,
            "createdAt": now_iso
        },
        notes="Assessment created and scored by backend underwriting pipeline."
    )

    return saved_doc

@router.post("/{assessment_id}/decision")
async def record_underwriter_decision(
    assessment_id: str,
    payload: UnderwriterDecisionPayload,
    token_payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    """Record an underwriter decision into MongoDB Atlas and append to decision audit history."""
    actor = await resolve_authenticated_actor(token_payload)

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

    if not is_authorized_for_assessment(asm, actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not authorized to modify this assessment."
        )

    # Authority tier and coverage limit validation derived strictly from verified JWT
    user_tier = actor["authorityTier"]
    authority_limit_inr = actor["authorityLimitInr"]

    if payload.decision == "Approve":
        if asm.get("riskLevel") == "HIGH" and user_tier == "tier-1":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tier 1 permission level restricts independent approval on HIGH risk assessments. Escalation / referral to senior committee is required."
            )

        linked_coverage_limit = await get_linked_policy_coverage_limit(asm)
        if linked_coverage_limit is not None and linked_coverage_limit > authority_limit_inr:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Linked policy annual coverage limit (₹{linked_coverage_limit:,.0f}) exceeds "
                    f"your {user_tier.upper()} authority limit (₹{authority_limit_inr:,.0f}). "
                    "Escalation / referral to a higher authority tier is required."
                )
            )

    # Ignore payload.user; bind actor identity strictly from verified JWT claims
    actor_user = actor["name"]
    actor_role = actor["role"]
    now_iso = utc_now_iso()

    new_history_entry = {
        "id": f"dh-{uuid.uuid4().hex[:10]}",
        "action": payload.decision,
        "user": actor_user,
        "role": actor_role,
        "timestamp": now_iso,
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
        "lastModifiedAt": now_iso
    }

    # Preserve createdAt without ever resetting it
    preserved_created_at = asm.get("createdAt") or now_iso

    if settings.TESTING or not db_instance.is_connected:
        asm["status"] = updated_status
        asm["createdAt"] = preserved_created_at
        asm["updatedAt"] = now_iso
        asm["lastUpdated"] = now_iso
        asm["underwriterDecision"] = updated_decision_block
        history = asm.get("decisionHistory") or []
        asm["decisionHistory"] = [new_history_entry] + history
        TEST_ASSESSMENTS_STORE[assessment_id] = asm
        updated_asm = dict(asm)
    else:
        assessments_coll = get_assessments_collection()
        update_fields: Dict[str, Any] = {
            "status": updated_status,
            "updatedAt": now_iso,
            "lastUpdated": now_iso,
            "underwriterDecision": updated_decision_block
        }
        if not asm.get("createdAt"):
            update_fields["createdAt"] = preserved_created_at

        await assessments_coll.update_one(
            {"id": assessment_id},
            {
                "$set": update_fields,
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

        saved_updated = await assessments_coll.find_one({"id": assessment_id})
        updated_asm = clean_doc(dict(saved_updated)) if saved_updated else clean_doc(dict(asm))

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
            "mlScore": asm.get("mlScore"),
            "authorityTier": user_tier,
            "authorityLimitInr": authority_limit_inr,
            "updatedAt": now_iso
        },
        notes=payload.notes
    )

    return {"success": True, "decision": new_history_entry, "assessment": updated_asm}

@router.post("/{assessment_id}/information-request")
async def request_information(
    assessment_id: str,
    payload: InformationRequestPayload,
    token_payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    """Dispatch questionnaire and record information gap update."""
    actor = await resolve_authenticated_actor(token_payload)

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

    if not is_authorized_for_assessment(asm, actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not authorized to modify this assessment."
        )

    now_iso = utc_now_iso()
    request_id = f"ir-{uuid.uuid4().hex[:10]}"
    request_doc = {
        "id": request_id,
        "assessmentId": assessment_id,
        "createdByUserId": actor["id"],
        "createdByEmail": actor["email"],
        "gapTitle": payload.gapTitle,
        "recipient": payload.recipient,
        "urgency": payload.urgency,
        "questions": payload.questions,
        "createdAt": now_iso,
        "status": "DISPATCHED"
    }

    gaps = list(asm.get("informationGaps") or [])
    if payload.gapTitle:
        for g in gaps:
            if isinstance(g, dict) and g.get("title") == payload.gapTitle:
                g["status"] = "Requested"
                g["requestedAt"] = now_iso
    unresolved_count = len([g for g in gaps if isinstance(g, dict) and g.get("status") != "Resolved"])
    preserved_created_at = asm.get("createdAt") or now_iso

    if settings.TESTING or not db_instance.is_connected:
        TEST_INFO_REQUESTS_STORE[request_id] = request_doc
        asm["informationGaps"] = gaps
        asm["informationGapsCount"] = unresolved_count
        asm["status"] = "Information Requested"
        asm["createdAt"] = preserved_created_at
        asm["updatedAt"] = now_iso
        asm["lastUpdated"] = now_iso
        TEST_ASSESSMENTS_STORE[assessment_id] = asm
        updated_asm = dict(asm)
    else:
        info_coll = get_information_requests_collection()
        await info_coll.insert_one(dict(request_doc))

        assessments_coll = get_assessments_collection()
        update_fields: Dict[str, Any] = {
            "informationGaps": gaps,
            "informationGapsCount": unresolved_count,
            "status": "Information Requested",
            "updatedAt": now_iso,
            "lastUpdated": now_iso
        }
        if not asm.get("createdAt"):
            update_fields["createdAt"] = preserved_created_at

        await assessments_coll.update_one(
            {"id": assessment_id},
            {"$set": update_fields}
        )
        saved_updated = await assessments_coll.find_one({"id": assessment_id})
        updated_asm = clean_doc(dict(saved_updated)) if saved_updated else clean_doc(dict(asm))

    await log_audit_trail(
        entity_type="information_request",
        entity_id=request_id,
        action=f"Dispatched Information Request to {payload.recipient}",
        actor_name=actor["name"],
        actor_role=actor["role"],
        details=request_doc,
        notes=f"Questions: {len(payload.questions)}"
    )

    return {
        "success": True,
        "message": f"Questionnaire dispatched to {payload.recipient}",
        "dispatchedAt": now_iso,
        "assessment": updated_asm
    }

@router.put("/{assessment_id}", response_model=Dict[str, Any])
async def update_assessment(
    assessment_id: str,
    payload: AssessmentUpdatePayload,
    token_payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    """
    Edit supported pet, medical, and insurance fields on an existing assessment,
    rerun backend rule/ML/SHAP reassessment, sync linked pet data, and record audit history.
    """
    actor = await resolve_authenticated_actor(token_payload)

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

    asm = clean_doc(dict(asm))
    if not is_authorized_for_assessment(asm, actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not authorized to edit this assessment."
        )

    if _is_assessment_archived(asm):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"Assessment '{assessment_id}' is archived and cannot be edited."
        )

    current_status = asm.get("status", "Under Review")
    is_finalized = current_status in ("Approved", "Rejected")
    if is_finalized and not payload.reopenForReassessment:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Assessment '{assessment_id}' has a finalized decision ({current_status}) and cannot be overwritten silently. "
                "Confirm reopening for reassessment to submit updated inputs."
            )
        )

    # Fetch linked pet document if present
    pet_id = asm.get("petId")
    pet_doc: Optional[Dict[str, Any]] = None
    if pet_id:
        if settings.TESTING or not db_instance.is_connected:
            from app.api.routes_pets import TEST_PETS_STORE
            pet_doc = TEST_PETS_STORE.get(pet_id)
            if pet_doc:
                pet_doc = dict(pet_doc)
        else:
            pets_coll = get_pets_collection()
            raw_pet = await pets_coll.find_one({"id": pet_id})
            if raw_pet:
                pet_doc = clean_doc(dict(raw_pet))

    previous_snapshot = {
        "petName": asm.get("petName"),
        "species": asm.get("species"),
        "breed": asm.get("breed"),
        "ageText": asm.get("ageText"),
        "ageYears": asm.get("ageYears") if asm.get("ageYears") is not None else (pet_doc.get("age") if pet_doc else None),
        "sex": asm.get("sex"),
        "weightKg": asm.get("weightKg") if asm.get("weightKg") is not None else (pet_doc.get("weightKg") if pet_doc else None),
        "ruleScore": asm.get("ruleScore"),
        "mlScore": asm.get("mlScore"),
        "combinedScore": asm.get("combinedScore"),
        "riskLevel": asm.get("riskLevel"),
        "status": current_status,
    }

    changed_fields: List[str] = []
    updated_asm = dict(asm)
    underwriting_data = dict(updated_asm.get("underwritingData") or {})

    def _apply_field(target: Dict[str, Any], key: str, new_val: Any, label: Optional[str] = None):
        if new_val is not None and target.get(key) != new_val:
            target[key] = new_val
            changed_fields.append(label or key)

    # 1. Pet information
    _apply_field(updated_asm, "petName", payload.petName.strip() if payload.petName else None, "petName")
    _apply_field(updated_asm, "species", payload.species.strip() if payload.species else None, "species")
    _apply_field(updated_asm, "breed", payload.breed.strip() if payload.breed else None, "breed")
    _apply_field(updated_asm, "sex", payload.sex.strip() if payload.sex else None, "sex")
    _apply_field(updated_asm, "weightKg", payload.weightKg, "weightKg")

    if payload.ageYears is not None:
        _apply_field(updated_asm, "ageYears", payload.ageYears, "ageYears")
        formatted_age = f"{int(payload.ageYears) if float(payload.ageYears).is_integer() else payload.ageYears} years"
        updated_asm["ageText"] = payload.ageText or formatted_age
    elif payload.ageText is not None:
        _apply_field(updated_asm, "ageText", payload.ageText, "ageText")

    # 2. Medical information on underwritingData & linked pet
    for ud_key, val in [
        ("preExistingConditions", payload.preExistingConditions),
        ("previousIllnesses", payload.previousIllnesses),
        ("previousSurgeries", payload.previousSurgeries),
        ("allergies", payload.allergies),
        ("currentMedications", payload.currentMedications),
        ("vaccinationDeclaration", payload.vaccinationDeclaration),
        ("previousClaims", payload.previousClaims),
        ("coverageTier", payload.coverageTier),
        ("coverageLimitInr", payload.coverageLimitInr),
        ("deductibleInr", payload.deductibleInr),
        ("copayPercent", payload.copayPercent),
        ("previousInsurance", payload.previousInsurance),
    ]:
        _apply_field(underwriting_data, ud_key, val, ud_key)

    updated_asm["underwritingData"] = underwriting_data
    if payload.coverageTier is not None:
        updated_asm["coverageTier"] = payload.coverageTier
    if payload.coverageLimitInr is not None:
        updated_asm["annualCoverageLimit"] = payload.coverageLimitInr
        updated_asm["coverageLimitInr"] = payload.coverageLimitInr
    if payload.deductibleInr is not None:
        updated_asm["deductibleInr"] = payload.deductibleInr
    if payload.copayPercent is not None:
        updated_asm["copayPercent"] = payload.copayPercent

    # Sync linked pet fields
    if pet_doc is not None:
        if payload.petName is not None:
            pet_doc["name"] = payload.petName.strip()
        if payload.species is not None:
            pet_doc["species"] = payload.species.strip()
        if payload.breed is not None:
            pet_doc["breed"] = payload.breed.strip()
        if payload.sex is not None:
            pet_doc["sex"] = payload.sex.strip()
        if payload.ageYears is not None:
            pet_doc["age"] = max(1, int(round(payload.ageYears)))
            pet_doc["ageUnit"] = "years"
        if payload.weightKg is not None:
            pet_doc["weightKg"] = payload.weightKg
        for list_key, list_val in [
            ("medicalHistory", payload.medicalHistory),
            ("vaccinations", payload.vaccinations),
            ("medications", payload.medications),
            ("surgeries", payload.surgeries),
            ("claims", payload.claims),
        ]:
            if list_val is not None:
                if pet_doc.get(list_key) != list_val:
                    changed_fields.append(list_key)
                pet_doc[list_key] = list_val

        # Sync policy terms on linked pet
        policies = list(pet_doc.get("policies") or [])
        if policies:
            target_idx = next(
                (idx for idx, p in enumerate(policies) if isinstance(p, dict) and p.get("policyNumber") == updated_asm.get("policyId")),
                0
            )
            if isinstance(policies[target_idx], dict):
                pol = dict(policies[target_idx])
                if payload.coverageTier is not None:
                    pol["tier"] = payload.coverageTier
                if payload.coverageLimitInr is not None:
                    pol["annualCoverageLimit"] = payload.coverageLimitInr
                if payload.deductibleInr is not None:
                    pol["deductible"] = payload.deductibleInr
                if payload.copayPercent is not None:
                    pol["copayPercent"] = payload.copayPercent
                if is_finalized and payload.reopenForReassessment:
                    pol["status"] = "Under Review"
                policies[target_idx] = pol
                pet_doc["policies"] = policies

    # 3. Build full feature vector & ALWAYS re-run backend Rule Engine + ML + SHAP
    feature_vector = dict(updated_asm)
    if updated_asm.get("ageYears") is not None:
        feature_vector["age"] = updated_asm["ageYears"]
    elif pet_doc and pet_doc.get("age"):
        feature_vector["age"] = pet_doc.get("age")

    if pet_doc:
        if not feature_vector.get("weightKg"):
            feature_vector["weightKg"] = pet_doc.get("weightKg")
        feature_vector["medicalHistory"] = payload.medicalHistory if payload.medicalHistory is not None else pet_doc.get("medicalHistory", [])
        feature_vector["vaccinations"] = payload.vaccinations if payload.vaccinations is not None else pet_doc.get("vaccinations", [])
        feature_vector["medications"] = payload.medications if payload.medications is not None else pet_doc.get("medications", [])
        feature_vector["surgeries"] = payload.surgeries if payload.surgeries is not None else pet_doc.get("surgeries", [])
        feature_vector["claims"] = payload.claims if payload.claims is not None else pet_doc.get("claims", [])

    scoring = _execute_scoring_pipeline(feature_vector)
    updated_asm.update(scoring)

    now_iso = utc_now_iso()
    updated_asm["updatedAt"] = now_iso
    updated_asm["lastUpdated"] = now_iso
    updated_asm["createdAt"] = asm.get("createdAt") or now_iso

    # Handle finalized reassessment reopening
    decision_block = dict(updated_asm.get("underwriterDecision") or {})
    decision_block["recommendation"] = scoring["riskLevel"]
    if is_finalized and payload.reopenForReassessment:
        updated_asm["status"] = "Under Review"
        decision_block["selectedDecision"] = None
        decision_block["underwriterNotes"] = payload.editReason or f"Reopened for reassessment by {actor['name']}."
        decision_block["lastModifiedBy"] = actor["name"]
        decision_block["lastModifiedAt"] = now_iso
        if pet_doc is not None and pet_doc.get("policyStatus") == "Active":
            pet_doc["policyStatus"] = "Under Review"
    updated_asm["underwriterDecision"] = decision_block

    prev_score = previous_snapshot.get("combinedScore")
    new_score = scoring["combinedScore"]
    fields_summary = ", ".join(changed_fields) if changed_fields else "clinical dossier review"
    history_action = "Reopened for Reassessment" if (is_finalized and payload.reopenForReassessment) else "Assessment Edited & Reassessed"
    history_note = (
        f"Updated {fields_summary}. "
        f"Combined score recalculated: {prev_score} ({previous_snapshot.get('riskLevel')}) -> "
        f"{new_score} ({scoring['riskLevel']})."
    )
    if payload.editReason:
        history_note = f"{payload.editReason} | {history_note}"

    new_history_entry = {
        "id": f"dh-{uuid.uuid4().hex[:10]}",
        "action": history_action,
        "user": actor["name"],
        "role": actor["role"],
        "timestamp": now_iso,
        "notes": history_note,
        "ruleScoreAtTime": scoring["ruleScore"],
        "mlScoreAtTime": scoring["mlScore"]
    }
    updated_asm["decisionHistory"] = [new_history_entry] + list(asm.get("decisionHistory") or [])

    # Sync pet risk score & persist
    if pet_doc is not None:
        pet_doc["riskLevel"] = scoring["riskLevel"]
        pet_doc["riskScore"] = scoring["combinedScore"]
        if settings.TESTING or not db_instance.is_connected:
            from app.api.routes_pets import TEST_PETS_STORE
            TEST_PETS_STORE[pet_id] = pet_doc
        else:
            pets_coll = get_pets_collection()
            await pets_coll.update_one({"id": pet_id}, {"$set": pet_doc})

    if settings.TESTING or not db_instance.is_connected:
        TEST_ASSESSMENTS_STORE[assessment_id] = updated_asm
        saved_doc = dict(updated_asm)
    else:
        assessments_coll = get_assessments_collection()
        await assessments_coll.update_one({"id": assessment_id}, {"$set": updated_asm})
        saved = await assessments_coll.find_one({"id": assessment_id})
        saved_doc = clean_doc(dict(saved)) if saved else dict(updated_asm)

    await log_audit_trail(
        entity_type="assessment",
        entity_id=assessment_id,
        action=history_action,
        actor_name=actor["name"],
        actor_role=actor["role"],
        details={
            "changedFields": changed_fields,
            "previous": previous_snapshot,
            "updated": {
                "petName": updated_asm.get("petName"),
                "species": updated_asm.get("species"),
                "breed": updated_asm.get("breed"),
                "ageText": updated_asm.get("ageText"),
                "weightKg": updated_asm.get("weightKg"),
                "ruleScore": scoring["ruleScore"],
                "mlScore": scoring["mlScore"],
                "combinedScore": scoring["combinedScore"],
                "riskLevel": scoring["riskLevel"],
                "status": updated_asm.get("status"),
            },
            "reopened": bool(is_finalized and payload.reopenForReassessment),
            "updatedAt": now_iso
        },
        notes=history_note
    )

    return saved_doc

@router.delete("/{assessment_id}")
async def delete_assessment(
    assessment_id: str,
    token_payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    """
    Soft-delete / archive an assessment while preserving decisionHistory, audit logs,
    linked pet records, owner records, and claims.
    """
    actor = await resolve_authenticated_actor(token_payload)

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

    asm = clean_doc(dict(asm))
    if not _is_owner_or_admin(asm, actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only the assessment owner or an Administrator can delete this assessment."
        )

    if _is_assessment_archived(asm):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment '{assessment_id}' has already been deleted/archived."
        )

    current_status = asm.get("status", "Under Review")
    is_admin = actor.get("role", "").strip().lower() == "administrator"
    if current_status in ("Approved", "Rejected") and not is_admin and actor.get("authorityTier") in ("tier-1", "tier-2"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Finalized assessments ({current_status}) cannot be deleted by {actor['authorityTier'].upper()} authority. "
                "Tier 3/4 or Administrator authorization is required."
            )
        )

    now_iso = utc_now_iso()
    archive_entry = {
        "id": f"dh-{uuid.uuid4().hex[:10]}",
        "action": "Assessment Archived",
        "user": actor["name"],
        "role": actor["role"],
        "timestamp": now_iso,
        "notes": f"Assessment archived from status '{current_status}'. Linked pet and audit records preserved.",
        "ruleScoreAtTime": asm.get("ruleScore", 50),
        "mlScoreAtTime": asm.get("mlScore", 50)
    }

    archive_fields = {
        "isDeleted": True,
        "previousStatus": current_status,
        "status": "Archived",
        "archivedAt": now_iso,
        "updatedAt": now_iso,
        "lastUpdated": now_iso,
        "deletedByUserId": actor["id"],
        "deletedByName": actor["name"],
    }

    if settings.TESTING or not db_instance.is_connected:
        asm.update(archive_fields)
        asm["decisionHistory"] = [archive_entry] + list(asm.get("decisionHistory") or [])
        TEST_ASSESSMENTS_STORE[assessment_id] = asm
    else:
        assessments_coll = get_assessments_collection()
        await assessments_coll.update_one(
            {"id": assessment_id},
            {
                "$set": archive_fields,
                "$push": {
                    "decisionHistory": {
                        "$each": [archive_entry],
                        "$position": 0
                    }
                }
            }
        )

    await log_audit_trail(
        entity_type="assessment",
        entity_id=assessment_id,
        action="Assessment Archived / Deleted",
        actor_name=actor["name"],
        actor_role=actor["role"],
        details={
            "previousStatus": current_status,
            "petId": asm.get("petId"),
            "petName": asm.get("petName"),
            "riskLevel": asm.get("riskLevel"),
            "combinedScore": asm.get("combinedScore"),
            "archivedAt": now_iso,
            "linkedPetPreserved": True
        },
        notes=f"Soft-deleted assessment '{assessment_id}'; linked pet '{asm.get('petId')}' preserved."
    )

    return {
        "success": True,
        "id": assessment_id,
        "status": "Archived",
        "archivedAt": now_iso
    }


@router.post("/{assessment_id}/documents/upload", response_model=Dict[str, Any])
async def upload_assessment_document(
    assessment_id: str,
    file: UploadFile = File(...),
    token_payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    """
    Upload a veterinary PDF or image document, extract text via PDF/OCR,
    run structured medical extraction, and compare against existing declarations
    without modifying risk scores or auto-verifying the document.
    """
    actor = await resolve_authenticated_actor(token_payload)

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

    asm = clean_doc(dict(asm))
    if not is_authorized_for_assessment(asm, actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not authorized to upload documents to this assessment."
        )

    if _is_assessment_archived(asm):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"Assessment '{assessment_id}' is archived and cannot accept documents."
        )

    filename = file.filename or "document"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext or 'unknown'}'. Please upload a PDF or image (PNG, JPG, WEBP, TIFF)."
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )
    if len(file_bytes) > MAX_DOCUMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Uploaded file exceeds the 15 MB limit."
        )

    # Fetch linked pet for comparison context
    pet_id = asm.get("petId")
    pet_doc: Optional[Dict[str, Any]] = None
    if pet_id:
        if settings.TESTING or not db_instance.is_connected:
            from app.api.routes_pets import TEST_PETS_STORE
            raw_pet = TEST_PETS_STORE.get(pet_id)
            pet_doc = dict(raw_pet) if raw_pet else None
        else:
            pets_coll = get_pets_collection()
            raw_pet = await pets_coll.find_one({"id": pet_id})
            pet_doc = clean_doc(dict(raw_pet)) if raw_pet else None

    doc_record = await analyze_veterinary_document(
        file_bytes=file_bytes,
        filename=filename,
        content_type=file.content_type,
        uploaded_by=actor["name"],
        assessment=asm,
        pet_doc=pet_doc,
    )

    now_iso = utc_now_iso()
    existing_docs = list(asm.get("uploadedDocuments") or [])
    updated_docs = [doc_record] + existing_docs

    history_entry = {
        "id": f"dh-{uuid.uuid4().hex[:10]}",
        "action": "Document Uploaded",
        "user": actor["name"],
        "role": actor["role"],
        "timestamp": now_iso,
        "notes": (
            f"Uploaded '{filename}' ({doc_record['extractionMethod']}). "
            f"Matches: {doc_record['summary']['matchesCount']}, "
            f"Discrepancies: {doc_record['summary']['discrepanciesCount']}, "
            f"Missing in declaration: {doc_record['summary']['missingInDeclarationCount']}."
        ),
        "ruleScoreAtTime": asm.get("ruleScore", 0),
        "mlScoreAtTime": asm.get("mlScore", 0),
    }

    # IMPORTANT: Do NOT modify combinedScore, ruleScore, mlScore, or riskLevel on upload
    if settings.TESTING or not db_instance.is_connected:
        asm["uploadedDocuments"] = updated_docs
        asm["updatedAt"] = now_iso
        asm["lastUpdated"] = now_iso
        asm["decisionHistory"] = [history_entry] + list(asm.get("decisionHistory") or [])
        TEST_ASSESSMENTS_STORE[assessment_id] = asm
        saved_asm = dict(asm)
    else:
        assessments_coll = get_assessments_collection()
        await assessments_coll.update_one(
            {"id": assessment_id},
            {
                "$set": {
                    "uploadedDocuments": updated_docs,
                    "updatedAt": now_iso,
                    "lastUpdated": now_iso,
                },
                "$push": {
                    "decisionHistory": {
                        "$each": [history_entry],
                        "$position": 0,
                    }
                },
            },
        )
        saved = await assessments_coll.find_one({"id": assessment_id})
        saved_asm = clean_doc(dict(saved)) if saved else dict(asm)

    await log_audit_trail(
        entity_type="assessment",
        entity_id=assessment_id,
        action="Veterinary Document Uploaded",
        actor_name=actor["name"],
        actor_role=actor["role"],
        details={
            "documentId": doc_record["id"],
            "fileName": filename,
            "extractionMethod": doc_record["extractionMethod"],
            "extractionEngine": doc_record["extractionEngine"],
            "summary": doc_record["summary"],
            "verificationStatus": doc_record["verificationStatus"],
        },
        notes=f"Extracted veterinary document '{filename}' for review; risk score unchanged.",
    )

    return {"document": doc_record, "assessment": saved_asm}


@router.post("/{assessment_id}/documents/{doc_id}/review", response_model=Dict[str, Any])
async def review_assessment_document(
    assessment_id: str,
    doc_id: str,
    payload: DocumentReviewPayload,
    token_payload: Dict[str, Any] = Depends(get_current_user_payload)
):
    """
    Allow an authorized underwriter to review an uploaded veterinary document,
    accept selected extracted corrections into medical declarations, or dismiss findings.
    Preserves existing assessment risk score unless an explicit reassessment is performed.
    """
    actor = await resolve_authenticated_actor(token_payload)

    if payload.action not in ("ACCEPT_CORRECTIONS", "DISMISS"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review action. Must be 'ACCEPT_CORRECTIONS' or 'DISMISS'."
        )

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

    asm = clean_doc(dict(asm))
    if not is_authorized_for_assessment(asm, actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not authorized to review documents on this assessment."
        )

    if _is_assessment_archived(asm):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"Assessment '{assessment_id}' is archived."
        )

    docs = list(asm.get("uploadedDocuments") or [])
    target_idx = next((i for i, d in enumerate(docs) if isinstance(d, dict) and d.get("id") == doc_id), None)
    if target_idx is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{doc_id}' not found on assessment '{assessment_id}'."
        )

    doc_record = dict(docs[target_idx])
    extracted_fields = dict(doc_record.get("extractedFields") or {})
    underwriting_data = dict(asm.get("underwritingData") or {})
    now_iso = utc_now_iso()
    applied_fields: List[str] = []

    if payload.action == "ACCEPT_CORRECTIONS":
        allowed_review_fields = {
            "preExistingConditions",
            "previousIllnesses",
            "previousSurgeries",
            "currentMedications",
            "vaccinationDeclaration",
            "allergies",
            "previousClaims",
        }
        selected = payload.acceptedFields or [
            k for k in allowed_review_fields if extracted_fields.get(k)
        ]
        for field_key in selected:
            if field_key in allowed_review_fields and extracted_fields.get(field_key):
                underwriting_data[field_key] = extracted_fields[field_key]
                applied_fields.append(field_key)

        doc_record["reviewStatus"] = "ACCEPTED"
        doc_record["verificationStatus"] = (
            "UNDERWRITER_VERIFIED" if payload.verifyAccepted else "ACCEPTED_UNVERIFIED"
        )
        doc_record["acceptedFields"] = applied_fields
    else:
        doc_record["reviewStatus"] = "DISMISSED"

    doc_record["reviewedBy"] = actor["name"]
    doc_record["reviewedAt"] = now_iso
    doc_record["reviewNotes"] = payload.reviewNotes
    docs[target_idx] = doc_record

    # Sync accepted fields to linked pet declaredMedicalInformation if pet exists
    pet_id = asm.get("petId")
    if pet_id and applied_fields:
        if settings.TESTING or not db_instance.is_connected:
            from app.api.routes_pets import TEST_PETS_STORE
            pet_doc = TEST_PETS_STORE.get(pet_id)
            if pet_doc:
                pet_doc = dict(pet_doc)
                declared_info = dict(pet_doc.get("declaredMedicalInformation") or {})
                for fk in applied_fields:
                    declared_info[fk] = str(underwriting_data.get(fk, ""))
                pet_doc["declaredMedicalInformation"] = declared_info
                TEST_PETS_STORE[pet_id] = pet_doc
        else:
            pets_coll = get_pets_collection()
            pet_doc = await pets_coll.find_one({"id": pet_id})
            if pet_doc:
                declared_info = dict(pet_doc.get("declaredMedicalInformation") or {})
                for fk in applied_fields:
                    declared_info[fk] = str(underwriting_data.get(fk, ""))
                await pets_coll.update_one(
                    {"id": pet_id},
                    {"$set": {"declaredMedicalInformation": declared_info}},
                )

    action_label = "Document Corrections Accepted" if payload.action == "ACCEPT_CORRECTIONS" else "Document Review Dismissed"
    history_note = (
        f"Accepted extracted corrections for {', '.join(applied_fields) or 'selected fields'} from '{doc_record.get('fileName')}'."
        if payload.action == "ACCEPT_CORRECTIONS"
        else f"Dismissed extracted findings from '{doc_record.get('fileName')}'."
    )
    if payload.reviewNotes:
        history_note = f"{history_note} Notes: {payload.reviewNotes}"

    history_entry = {
        "id": f"dh-{uuid.uuid4().hex[:10]}",
        "action": action_label,
        "user": actor["name"],
        "role": actor["role"],
        "timestamp": now_iso,
        "notes": history_note,
        "ruleScoreAtTime": asm.get("ruleScore", 0),
        "mlScoreAtTime": asm.get("mlScore", 0),
    }

    if settings.TESTING or not db_instance.is_connected:
        asm["uploadedDocuments"] = docs
        asm["underwritingData"] = underwriting_data
        asm["updatedAt"] = now_iso
        asm["lastUpdated"] = now_iso
        asm["decisionHistory"] = [history_entry] + list(asm.get("decisionHistory") or [])
        TEST_ASSESSMENTS_STORE[assessment_id] = asm
        saved_asm = dict(asm)
    else:
        assessments_coll = get_assessments_collection()
        await assessments_coll.update_one(
            {"id": assessment_id},
            {
                "$set": {
                    "uploadedDocuments": docs,
                    "underwritingData": underwriting_data,
                    "updatedAt": now_iso,
                    "lastUpdated": now_iso,
                },
                "$push": {
                    "decisionHistory": {
                        "$each": [history_entry],
                        "$position": 0,
                    }
                },
            },
        )
        saved = await assessments_coll.find_one({"id": assessment_id})
        saved_asm = clean_doc(dict(saved)) if saved else dict(asm)

    await log_audit_trail(
        entity_type="assessment",
        entity_id=assessment_id,
        action=action_label,
        actor_name=actor["name"],
        actor_role=actor["role"],
        details={
            "documentId": doc_id,
            "appliedFields": applied_fields,
            "verifyAccepted": payload.verifyAccepted,
            "reviewStatus": doc_record["reviewStatus"],
        },
        notes=history_note,
    )

    return {"document": doc_record, "assessment": saved_asm}


