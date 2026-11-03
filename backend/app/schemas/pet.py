from typing import List, Optional
from pydantic import BaseModel, Field

class MedicalRecordSchema(BaseModel):
    id: str
    date: str
    event: str
    diagnosis: str
    treatment: str
    outcome: str
    clinicName: str
    veterinarian: str
    notes: Optional[str] = None

class VaccinationRecordSchema(BaseModel):
    id: str
    vaccineName: str
    administeredDate: str
    nextDueDate: str
    batchNumber: str
    status: str = "Up to Date"  # 'Up to Date' | 'Due Soon' | 'Overdue'

class MedicationRecordSchema(BaseModel):
    id: str
    name: str
    dosage: str
    frequency: str
    startDate: str
    endDate: Optional[str] = None
    prescribedFor: str

class SurgeryRecordSchema(BaseModel):
    id: str
    surgeryName: str
    date: str
    hospital: str
    surgeon: str
    complications: str = "None"
    postOpRecovery: str = "Complete recovery"

class PolicySummarySchema(BaseModel):
    id: str
    policyNumber: str
    tier: str = "Comprehensive"
    annualCoverageLimit: float = 500000.0
    deductible: float = 5000.0
    copayPercent: float = 10.0
    startDate: str
    renewalDate: str
    status: str = "Under Review"

class ClaimSummarySchema(BaseModel):
    id: str
    claimNumber: str
    treatment: str
    amountInr: float
    date: str
    status: str = "Under Review"

class PetSchema(BaseModel):
    id: str = Field(..., description="Unique pet identifier (e.g. pet-1)")
    name: str = Field(..., description="Pet given name")
    species: str = Field(default="Dog", description="Species (Dog, Cat, Other)")
    breed: str = Field(..., description="Breed classification")
    age: int = Field(default=2, description="Age value")
    ageUnit: str = Field(default="years", description="years or months")
    sex: str = Field(default="Male", description="Male or Female")
    weightKg: float = Field(default=15.0, description="Weight in kilograms")
    microchipId: Optional[str] = None
    imageUrl: str = Field(
        default="https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=800",
        description="Public image URL"
    )
    policyId: str = Field(..., description="Associated policy number")
    policyStatus: str = Field(default="Under Review", description="Policy status")
    riskLevel: str = Field(default="MEDIUM", description="Actuarial risk level (LOW, MEDIUM, HIGH)")
    riskScore: int = Field(default=50, description="Calculated actuarial risk score (0-100)")
    location: str = Field(default="Bengaluru, KA", description="City, Region")
    ownerName: str = Field(..., description="Pet owner contact name")
    ownerPhone: str = Field(default="+91 98888 00000", description="Owner contact telephone")
    registeredVetClinic: str = Field(default="Cessna Lifeline Veterinary Hospital", description="Primary veterinary facility")
    medicalHistory: List[MedicalRecordSchema] = Field(default_factory=list)
    vaccinations: List[VaccinationRecordSchema] = Field(default_factory=list)
    medications: List[MedicationRecordSchema] = Field(default_factory=list)
    surgeries: List[SurgeryRecordSchema] = Field(default_factory=list)
    policies: List[PolicySummarySchema] = Field(default_factory=list)
    claims: List[ClaimSummarySchema] = Field(default_factory=list)

