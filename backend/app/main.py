"""
PETRAILS — Intelligent Pet Insurance Risk & Claims Intelligence Backend
FastAPI REST API with PyMongo Async, MongoDB persistence, and Dual-Engine Actuarial Intelligence
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api.routes_health import router as health_router
from app.api.routes_auth import router as auth_router
from app.api.routes_pets import router as pets_router
from app.api.routes_assessments import router as assessments_router
from app.api.routes_claims import router as claims_router
from app.api.routes_operations import router as operations_router
from app.api.routes_analytics import router as analytics_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("petrails.api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to MongoDB Atlas and build indexes
    logger.info("Initializing PETRAILS enterprise engine...")
    await connect_to_mongo()
    yield
    # Shutdown: cleanly close database client
    logger.info("Shutting down PETRAILS backend services...")
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise API for pet insurance underwriting risk evaluation and claims anomaly detection.",
    version=settings.API_VERSION,
    lifespan=lifespan
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core routes
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(pets_router, prefix="/api/pets", tags=["Pets"])
app.include_router(assessments_router, prefix="/api/assessments", tags=["Assessments"])
app.include_router(claims_router, prefix="/api/claims", tags=["Claims"])
app.include_router(operations_router, prefix="/api", tags=["Operations"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])

# Consistent JSON error handling
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.url}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"message": "Invalid request parameters", "details": exc.errors()}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error processing {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"message": "Internal server error occurred.", "error": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

