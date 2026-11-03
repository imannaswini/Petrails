from fastapi import APIRouter
from app.core.config import settings
from app.core.database import ping_database
from app.schemas.health import HealthResponse, DatabaseHealth

router = APIRouter()

@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint reporting backend state and MongoDB Atlas connectivity.
    Compatible with frontend heartbeat and deployment probes.
    """
    db_health = await ping_database()
    return HealthResponse(
        status="healthy" if db_health["connected"] else "degraded",
        service=settings.PROJECT_NAME,
        version=settings.API_VERSION,
        port=settings.PORT,
        database=DatabaseHealth(
            connected=db_health["connected"],
            is_atlas=db_health["is_atlas"],
            database=db_health["database"],
            error=db_health["error"]
        )
    )

