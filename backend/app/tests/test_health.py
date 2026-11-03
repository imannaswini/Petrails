import os
import sys

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.schemas.health import HealthResponse, DatabaseHealth

def test_atlas_config_detection():
    """Verify MongoDB Atlas URI parsing and configuration defaults."""
    assert settings.database_name == "petrails_db"
    assert settings.is_atlas is True

def test_health_response_schema():
    """Verify health check response schema aligns with frontend heartbeat contract."""
    health = HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.API_VERSION,
        port=settings.PORT,
        database=DatabaseHealth(
            connected=True,
            is_atlas=True,
            database=settings.database_name,
            error=None
        )
    )
    assert health.status == "healthy"
    assert health.service == settings.PROJECT_NAME
    assert health.version == settings.API_VERSION
    assert health.database.connected is True
    assert health.database.is_atlas is True
    assert health.database.database == "petrails_db"
