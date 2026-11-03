from typing import List, Optional, Tuple
from pydantic import BaseModel, Field

class AnomalyIndicatorSchema(BaseModel):
    name: str
    status: str = "Normal"  # 'Normal' | 'Low' | 'Moderate' | 'Elevated'
    detail: str

class InvoiceDetailsSchema(BaseModel):
    invoiceNumber: str
    clinicGstNumber: str = "29AAAAA0000A1Z5"
    clinicName: str
    procedureCodes: List[str] = Field(default_factory=list)
    medicationBilled: float = 0.0
    surgicalBilled: float = 0.0
    diagnosticBilled: float = 0.0
    roomCharges: float = 0.0
    totalBilledInr: float
    standardMarketRangeInr: List[float] = Field(default_factory=lambda: [10000.0, 25000.0])

class EvidenceItemSchema(BaseModel):
    id: str
    title: str
    type: str  # 'Pathology Report' | 'Veterinary Invoice' | 'Surgical Discharge Summary' | 'Radiograph' | 'Prescription'
    date: str
    source: str
    verified: bool = True
    notes: str = ""
    fileSize: str = "1.2 MB"

class ClaimDecisionSchema(BaseModel):
    status: str  # 'Approved' | 'Adjusted' | 'Information Requested' | 'Referred to Senior Adjuster'
    approvedAmountInr: Optional[float] = None
    notes: str = ""
    decidedBy: str = "Sarah Jenkins (Senior Underwriting & Claims Officer)"
    timestamp: str

class ClaimDecisionPayload(BaseModel):
    status: str = Field(..., description="'Approved' | 'Adjusted' | 'Information Requested' | 'Referred to Senior Adjuster'")
    notes: str = Field(default="", description="Adjuster reasoning")
    approvedAmountInr: Optional[float] = None
    decidedBy: Optional[str] = "Sarah Jenkins (Senior Underwriting & Claims Officer)"

class ClaimSchema(BaseModel):
    id: str = Field(..., description="Unique claim identifier e.g. cl-1")
    claimNumber: str = Field(..., description="Carrier claim tracking number e.g. CL-9821")
    petId: str
    petName: str
    breed: str
    species: str = "Dog"
    claimType: str = "Diagnostic Investigation"
    treatment: str
    amountInr: float
    date: str
    status: str = "Under Review"
    anomalyScore: int = Field(default=15, ge=0, le=100)
    anomalyLevel: str = "LOW CONCERN"  # 'LOW CONCERN' | 'MODERATE CONCERN' | 'ELEVATED CONCERN'
    indicators: List[AnomalyIndicatorSchema] = Field(default_factory=list)
    invoiceDetails: InvoiceDetailsSchema
    medicalEvidence: List[EvidenceItemSchema] = Field(default_factory=list)
    adjusterDecision: Optional[ClaimDecisionSchema] = None
    imageUrl: str = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=800"
    underwritingNotes: Optional[str] = None

