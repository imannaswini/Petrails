from typing import List, Optional
from pydantic import BaseModel, Field

class ShapFactorSchema(BaseModel):
    id: str
    name: str
    impact: float = Field(..., description="SHAP feature attribution impact (+/- score)")
    category: str = Field(..., description="Category: Medical History, Age & Breed, Vaccination, Claims, Geography")
    explanation: str
    confidence: float = 0.90

class InformationGapSchema(BaseModel):
    id: str
    title: str
    description: str
    questions: List[str]
    status: str = "Pending Request"  # 'Pending Request' | 'Requested' | 'Received' | 'Resolved'
    requestedAt: Optional[str] = None
    responseSummary: Optional[str] = None
    affectsCalibration: bool = True

class DecisionHistoryEntrySchema(BaseModel):
    id: str
    action: str  # 'Approve' | 'Request Information' | 'Refer for Review' | 'Condition Added'
    user: str = "Sarah Jenkins"
    role: str = "Senior Underwriting Officer"
    timestamp: str
    notes: str
    ruleScoreAtTime: int = 50
    mlScoreAtTime: int = 50

class UnderwriterDecisionBlockSchema(BaseModel):
    recommendation: Optional[str] = "MEDIUM"
    selectedDecision: Optional[str] = None
    underwriterNotes: Optional[str] = ""
    stipulations: Optional[List[str]] = Field(default_factory=list)
    lastModifiedBy: Optional[str] = None
    lastModifiedAt: Optional[str] = None

class AssessmentSchema(BaseModel):
    id: str = Field(..., description="Unique assessment identifier (e.g. asm-1)")
    petId: str = Field(..., description="Linked pet identifier")
    petName: str = Field(..., description="Pet name")
    breed: str
    species: str = "Dog"
    ageText: str = "2 years"
    sex: str = "Male"
    policyId: str
    riskLevel: str = "MEDIUM"  # 'LOW' | 'MEDIUM' | 'HIGH'
    combinedScore: int = Field(default=50, ge=0, le=100)
    ruleScore: int = Field(default=50, ge=0, le=100)
    mlScore: int = Field(default=50, ge=0, le=100)
    modelConfidence: int = Field(default=90, description="Confidence percentage e.g. 91")
    calibrationBand: str = "Calibrated ±3.0%"
    informationGapsCount: int = 0
    informationGaps: List[InformationGapSchema] = Field(default_factory=list)
    contributingFactors: List[ShapFactorSchema] = Field(default_factory=list)
    status: str = "Under Review"
    lastUpdated: str = "Just now"
    underwriterDecision: Optional[UnderwriterDecisionBlockSchema] = None
    decisionHistory: Optional[List[DecisionHistoryEntrySchema]] = Field(default_factory=list)
    imageUrl: str = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=800"

class UnderwriterDecisionPayload(BaseModel):
    decision: str = Field(..., description="'Approve' | 'Request Information' | 'Refer for Review'")
    notes: str = Field(default="", description="Actuarial justification and underwriter notes")
    stipulation: Optional[str] = None
    user: Optional[str] = "Sarah Jenkins"

class InformationRequestPayload(BaseModel):
    gapTitle: Optional[str] = None
    recipient: str = Field(default="clinic", description="'clinic' | 'owner' | 'both'")
    urgency: str = Field(default="Standard (48h)", description="Turnaround window")
    questions: List[str] = Field(default_factory=list)

