import time
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.core.database import (
    get_information_requests_collection,
    get_audit_logs_collection,
    get_notifications_collection,
    db_instance
)
from app.core.config import settings
from app.schemas.information_request import (
    InformationRequestDocSchema,
    UpdateInfoRequestStatusPayload,
    NotificationSchema,
    AuditLogItemSchema
)

logger = logging.getLogger("petrails.operations")
router = APIRouter()

# Test stores for fast offline/testing runs
TEST_INFO_STORE: Dict[str, Dict[str, Any]] = {}
TEST_AUDIT_STORE: List[Dict[str, Any]] = []
TEST_NOTIF_STORE: Dict[str, Dict[str, Any]] = {}

def clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    doc_copy = dict(doc)
    doc_copy.pop("_id", None)
    return doc_copy

# -------------------------------------------------------------
# Information Requests Queue
# -------------------------------------------------------------

@router.get("/information-requests", response_model=List[Dict[str, Any]], tags=["Information Requests"])
async def list_information_requests(assessment_id: Optional[str] = None):
    """Retrieve all clinical inquiries from MongoDB Atlas."""
    if settings.TESTING or not db_instance.is_connected:
        items = list(TEST_INFO_STORE.values())
        if assessment_id:
            items = [i for i in items if i.get("assessmentId") == assessment_id]
        return items

    info_coll = get_information_requests_collection()
    query = {"assessmentId": assessment_id} if assessment_id else {}
    cursor = info_coll.find(query).sort("createdAt", -1)
    results = []
    async for item in cursor:
        results.append(clean_doc(dict(item)))
    return results

@router.patch("/information-requests/{request_id}/status", tags=["Information Requests"])
async def update_information_request_status(request_id: str, payload: UpdateInfoRequestStatusPayload):
    """Update inquiry resolution status (DISPATCHED, RECEIVED, RESOLVED)."""
    if settings.TESTING or not db_instance.is_connected:
        if request_id not in TEST_INFO_STORE:
            raise HTTPException(status_code=404, detail="Inquiry not found")
        TEST_INFO_STORE[request_id]["status"] = payload.status
        if payload.responseSummary:
            TEST_INFO_STORE[request_id]["responseSummary"] = payload.responseSummary
        return {"success": True, "status": payload.status}

    info_coll = get_information_requests_collection()
    update_data: Dict[str, Any] = {"status": payload.status}
    if payload.responseSummary:
        update_data["responseSummary"] = payload.responseSummary

    res = await info_coll.update_one({"id": request_id}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return {"success": True, "status": payload.status}

# -------------------------------------------------------------
# Immutable Audit Logs
# -------------------------------------------------------------

@router.get("/audit-logs", response_model=List[Dict[str, Any]], tags=["Audit Logs"])
async def query_audit_logs(
    entity_type: Optional[str] = Query(None, description="e.g. assessment, claim, information_request"),
    entity_id: Optional[str] = Query(None, description="Specific entity ID"),
    limit: int = Query(50, ge=1, le=200)
):
    """Query immutable audit trail records from MongoDB Atlas."""
    entity_type_val = entity_type if isinstance(entity_type, str) else None
    entity_id_val = entity_id if isinstance(entity_id, str) else None
    limit_val = limit if isinstance(limit, int) else 50

    if settings.TESTING or not db_instance.is_connected:
        filtered = list(TEST_AUDIT_STORE)
        if entity_type_val:
            filtered = [a for a in filtered if a.get("entityType") == entity_type_val]
        if entity_id_val:
            filtered = [a for a in filtered if a.get("entityId") == entity_id_val]
        return filtered[:limit_val]

    audit_coll = get_audit_logs_collection()
    filter_query: Dict[str, Any] = {}
    if entity_type_val:
        filter_query["entityType"] = entity_type_val
    if entity_id_val:
        filter_query["entityId"] = entity_id_val

    cursor = audit_coll.find(filter_query).sort("epochMs", -1).limit(limit_val)
    logs = []
    async for entry in cursor:
        logs.append(clean_doc(dict(entry)))
    return logs

# -------------------------------------------------------------
# Notifications
# -------------------------------------------------------------

@router.get("/notifications", response_model=List[Dict[str, Any]], tags=["Notifications"])
async def list_notifications():
    """Retrieve user notifications from MongoDB Atlas."""
    if settings.TESTING or not db_instance.is_connected:
        return list(TEST_NOTIF_STORE.values())

    notif_coll = get_notifications_collection()
    cursor = notif_coll.find({}).sort("id", -1)
    results = []
    async for item in cursor:
        results.append(clean_doc(dict(item)))
    return results

@router.post("/notifications", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED, tags=["Notifications"])
async def create_notification(payload: NotificationSchema):
    """Create a new notification entry."""
    data = payload.model_dump()
    if settings.TESTING or not db_instance.is_connected:
        TEST_NOTIF_STORE[payload.id] = data
        return data

    notif_coll = get_notifications_collection()
    await notif_coll.update_one({"id": payload.id}, {"$set": data}, upsert=True)
    return data

@router.patch("/notifications/{notification_id}/read", tags=["Notifications"])
async def mark_notification_read(notification_id: str):
    """Mark a specific notification as read."""
    if settings.TESTING or not db_instance.is_connected:
        if notification_id in TEST_NOTIF_STORE:
            TEST_NOTIF_STORE[notification_id]["read"] = True
            return {"success": True}
        raise HTTPException(status_code=404, detail="Notification not found")

    notif_coll = get_notifications_collection()
    res = await notif_coll.update_one({"id": notification_id}, {"$set": {"read": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}

@router.post("/notifications/mark-all-read", tags=["Notifications"])
async def mark_all_notifications_read():
    """Mark all notifications as read."""
    if settings.TESTING or not db_instance.is_connected:
        for k in TEST_NOTIF_STORE:
            TEST_NOTIF_STORE[k]["read"] = True
        return {"success": True}

    notif_coll = get_notifications_collection()
    await notif_coll.update_many({}, {"$set": {"read": True}})
    return {"success": True}
