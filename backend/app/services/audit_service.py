import time
import logging
from typing import Optional, Dict, Any
from app.core.database import get_audit_logs_collection, db_instance
from app.core.config import settings

logger = logging.getLogger("petrails.audit")

async def log_audit_trail(
    entity_type: str,
    entity_id: str,
    action: str,
    actor_name: str,
    actor_role: str,
    details: Dict[str, Any],
    notes: Optional[str] = None
) -> Dict[str, Any]:
    """Save an immutable audit trail record into MongoDB Atlas."""
    audit_record = {
        "id": f"aud-{int(time.time() * 1000)}",
        "entityType": entity_type,
        "entityId": entity_id,
        "action": action,
        "actorName": actor_name,
        "actorRole": actor_role,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S IST"),
        "epochMs": int(time.time() * 1000),
        "notes": notes or "",
        "details": details
    }
    
    if not settings.TESTING and db_instance.is_connected:
        try:
            audit_collection = get_audit_logs_collection()
            await audit_collection.insert_one(audit_record)
        except Exception as e:
            logger.warning(f"Could not persist audit trail: {e}")
            
    return audit_record

