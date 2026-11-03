from typing import List, Optional
from pydantic import BaseModel, Field

class InformationRequestDocSchema(BaseModel):
    id: str = Field(..., description="Unique inquiry id (e.g. ir-123)")
    assessmentId: str = Field(..., description="Target assessment ID")
    gapTitle: Optional[str] = None
    recipient: str = Field(default="clinic", description="clinic | owner | both")
    urgency: str = Field(default="Standard (48h)")
    questions: List[str] = Field(default_factory=list)
    createdAt: str
    status: str = Field(default="DISPATCHED", description="DISPATCHED | RECEIVED | RESOLVED")

class UpdateInfoRequestStatusPayload(BaseModel):
    status: str = Field(..., description="DISPATCHED | RECEIVED | RESOLVED")
    responseSummary: Optional[str] = None

class NotificationSchema(BaseModel):
    id: str
    title: str
    description: str
    timestamp: str = "Just now"
    read: bool = False
    priority: str = "medium"  # high | medium | low
    link: str = "/assessments"
    type: str = "assessment"  # assessment | claim | info_request | system

class AuditLogItemSchema(BaseModel):
    id: str
    entityType: str
    entityId: str
    action: str
    actorName: str
    actorRole: str
    timestamp: str
    epochMs: int
    notes: Optional[str] = ""
    details: dict = Field(default_factory=dict)

