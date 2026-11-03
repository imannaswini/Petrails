from pydantic import BaseModel, Field
from typing import List

class RiskDistributionSchema(BaseModel):
    low: int = 0
    medium: int = 0
    high: int = 0

class ClaimsActivityItemSchema(BaseModel):
    month: str
    submitted: int = 0
    approved: int = 0
    flagged: int = 0
    averagePayoutInr: float = 0.0

class SpeciesBreakdownItemSchema(BaseModel):
    species: str
    percentage: float = 0.0
    count: int = 0

class BreedRiskTrendItemSchema(BaseModel):
    breed: str
    avgRiskScore: float = 0.0
    claimRatio: float = 0.0
    sampleSize: int = 0

class PortfolioMetricsSchema(BaseModel):
    totalApplications: int = 0
    requireAttention: int = 0
    claimsUnderReview: int = 0
    informationGaps: int = 0
    riskDistribution: RiskDistributionSchema = Field(default_factory=RiskDistributionSchema)
    claimsActivity: List[ClaimsActivityItemSchema] = Field(default_factory=list)
    speciesBreakdown: List[SpeciesBreakdownItemSchema] = Field(default_factory=list)
    breedRiskTrends: List[BreedRiskTrendItemSchema] = Field(default_factory=list)

