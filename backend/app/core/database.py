import logging
import asyncio
from typing import Optional, Dict, Any
from pymongo import AsyncMongoClient, ASCENDING
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.asynchronous.collection import AsyncCollection
from app.core.config import settings

logger = logging.getLogger("petrails.database")

class Database:
    client: Optional[AsyncMongoClient] = None
    db: Optional[AsyncDatabase] = None
    is_connected: bool = False
    last_error: Optional[str] = None

db_instance = Database()

async def connect_to_mongo():
    """Establish async connection to MongoDB Atlas with strict timeout and ensure indexes."""
    if settings.TESTING:
        logger.info("TESTING mode active: skipping network MongoDB connection.")
        db_instance.is_connected = True
        return

    target_host = settings.MONGODB_URI.split("@")[-1] if "@" in settings.MONGODB_URI else settings.MONGODB_URI
    logger.info(f"Connecting to MongoDB (Atlas: {settings.is_atlas}) at {target_host}...")
    try:
        db_instance.client = AsyncMongoClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000
        )
        db_instance.db = db_instance.client[settings.database_name]
        
        # Test connection ping with 5 second timeout
        await asyncio.wait_for(db_instance.db.command("ping"), timeout=5.0)
        db_instance.is_connected = True
        db_instance.last_error = None
        logger.info(f"Successfully connected to MongoDB database: {settings.database_name}")
        
        # Ensure indexes across all persistent collections
        await init_indexes()
    except Exception as e:
        db_instance.is_connected = False
        db_instance.last_error = str(e)
        logger.warning(f"MongoDB connection check notice: {e}")

async def ping_database() -> Dict[str, Any]:
    """Test live connectivity to MongoDB and return diagnostics."""
    if settings.TESTING:
        return {
            "connected": True,
            "is_atlas": settings.is_atlas,
            "database": settings.database_name,
            "error": None
        }
    if db_instance.client is None or db_instance.db is None:
        return {
            "connected": False,
            "is_atlas": settings.is_atlas,
            "database": settings.database_name,
            "error": "Client not initialized"
        }
    try:
        await asyncio.wait_for(db_instance.db.command("ping"), timeout=2.0)
        db_instance.is_connected = True
        return {
            "connected": True,
            "is_atlas": settings.is_atlas,
            "database": settings.database_name,
            "error": None
        }
    except Exception as e:
        db_instance.is_connected = False
        db_instance.last_error = str(e)
        return {
            "connected": False,
            "is_atlas": settings.is_atlas,
            "database": settings.database_name,
            "error": str(e)
        }

async def close_mongo_connection():
    """Close MongoDB connection gracefully."""
    if db_instance.client is not None:
        logger.info("Closing MongoDB connection...")
        await db_instance.client.close()
        db_instance.client = None
        db_instance.db = None
        db_instance.is_connected = False
        logger.info("MongoDB connection closed.")

async def init_indexes():
    """Initialize necessary indexes across collections."""
    if not db_instance.is_connected or db_instance.db is None:
        return
    db = db_instance.db
    try:
        # Users collection
        await db.users.create_index([("email", ASCENDING)], unique=True)
        await db.users.create_index([("id", ASCENDING)], unique=True)
        
        # Pets collection
        await db.pets.create_index([("id", ASCENDING)], unique=True)
        await db.pets.create_index([("policyId", ASCENDING)])
        
        # Assessments collection
        await db.assessments.create_index([("id", ASCENDING)], unique=True)
        await db.assessments.create_index([("petId", ASCENDING)])
        await db.assessments.create_index([("status", ASCENDING)])
        
        # Claims collection
        await db.claims.create_index([("id", ASCENDING)], unique=True)
        await db.claims.create_index([("claimNumber", ASCENDING)], unique=True)
        await db.claims.create_index([("petId", ASCENDING)])
        await db.claims.create_index([("status", ASCENDING)])
        
        # Notifications collection
        await db.notifications.create_index([("id", ASCENDING)], unique=True)
        await db.notifications.create_index([("read", ASCENDING)])
        await db.notifications.create_index([("timestamp", ASCENDING)])
        
        # Information requests collection
        await db.information_requests.create_index([("id", ASCENDING)], unique=True)
        await db.information_requests.create_index([("assessmentId", ASCENDING)])
        
        # Audit logs collection
        await db.audit_logs.create_index([("entityId", ASCENDING)])
        await db.audit_logs.create_index([("timestamp", ASCENDING)])
        
        logger.info("MongoDB indexes verified and ensured.")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")

def get_database() -> AsyncDatabase:
    """Dependency to retrieve the active database instance."""
    if db_instance.db is None:
        raise RuntimeError("Database connection has not been initialized.")
    return db_instance.db

# Collection accessor helpers
def get_users_collection() -> AsyncCollection:
    return get_database()["users"]

def get_pets_collection() -> AsyncCollection:
    return get_database()["pets"]

def get_assessments_collection() -> AsyncCollection:
    return get_database()["assessments"]

def get_claims_collection() -> AsyncCollection:
    return get_database()["claims"]

def get_notifications_collection() -> AsyncCollection:
    return get_database()["notifications"]

def get_information_requests_collection() -> AsyncCollection:
    return get_database()["information_requests"]

def get_audit_logs_collection() -> AsyncCollection:
    return get_database()["audit_logs"]

