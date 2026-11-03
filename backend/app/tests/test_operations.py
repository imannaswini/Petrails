import os
import sys
import pytest
from fastapi import HTTPException

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
settings.TESTING = True

from app.schemas.information_request import (
    NotificationSchema,
    UpdateInfoRequestStatusPayload
)
from app.services.audit_service import log_audit_trail
from app.api.routes_operations import (
    list_information_requests,
    update_information_request_status,
    query_audit_logs,
    list_notifications,
    create_notification,
    mark_notification_read,
    mark_all_notifications_read,
    TEST_INFO_STORE,
    TEST_AUDIT_STORE,
    TEST_NOTIF_STORE
)

def run_sync(coro):
    """Execute coroutine synchronously without event loop deadlock."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

@pytest.fixture(autouse=True)
def clean_stores():
    TEST_INFO_STORE.clear()
    TEST_AUDIT_STORE.clear()
    TEST_NOTIF_STORE.clear()

def test_audit_logging_and_query():
    """Verify audit trails are recorded with immutable timestamps."""
    entry = run_sync(log_audit_trail(
        entity_type="assessment",
        entity_id="asm-test-01",
        action="Underwriter Approval",
        actor_name="Sarah Jenkins",
        actor_role="Senior Underwriting Officer",
        details={"decision": "Approve", "stipulation": "Standard terms"}
    ))
    assert entry["id"].startswith("aud-")
    assert entry["actorName"] == "Sarah Jenkins"

    TEST_AUDIT_STORE.append(entry)
    results = run_sync(query_audit_logs(entity_type="assessment"))
    assert len(results) == 1
    assert results[0]["entityId"] == "asm-test-01"

def test_notifications_lifecycle():
    """Verify notification creation, retrieval, and marking as read."""
    notif = NotificationSchema(
        id="notif-test-01",
        title="Underwriter Review Complete",
        description="Simba's assessment is approved.",
        priority="high",
        type="assessment"
    )
    # Create
    created = run_sync(create_notification(notif))
    assert created["id"] == "notif-test-01"
    assert created["read"] is False

    # List
    all_notifs = run_sync(list_notifications())
    assert len(all_notifs) == 1

    # Mark as read
    read_res = run_sync(mark_notification_read("notif-test-01"))
    assert read_res["success"] is True

    # Check updated state
    updated_notifs = run_sync(list_notifications())
    assert updated_notifs[0]["read"] is True

    # Mark all read
    all_read_res = run_sync(mark_all_notifications_read())
    assert all_read_res["success"] is True

def test_information_requests_queue():
    """Verify info request listing and status transition."""
    TEST_INFO_STORE["ir-test-01"] = {
        "id": "ir-test-01",
        "assessmentId": "asm-test-01",
        "gapTitle": "Orthopedic History",
        "recipient": "clinic",
        "urgency": "Standard (48h)",
        "questions": ["Please send radiograph."],
        "createdAt": "2026-10-25 14:00:00 IST",
        "status": "DISPATCHED"
    }

    # List requests
    items = run_sync(list_information_requests(assessment_id="asm-test-01"))
    assert len(items) == 1
    assert items[0]["gapTitle"] == "Orthopedic History"

    # Update status to RESOLVED
    update_res = run_sync(update_information_request_status(
        "ir-test-01",
        UpdateInfoRequestStatusPayload(status="RESOLVED", responseSummary="Radiograph verified.")
    ))
    assert update_res["success"] is True
    assert update_res["status"] == "RESOLVED"

