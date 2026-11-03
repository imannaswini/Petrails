from typing import Optional, Dict, Any
from pydantic import BaseModel

class DatabaseHealth(BaseModel):
    connected: bool
    is_atlas: bool
    database: str
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    port: int
    database: DatabaseHealth

