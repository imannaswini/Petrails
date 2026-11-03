from fastapi import APIRouter
from typing import Dict, Any, List
from app.core.config import settings
from app.core.database import (
    get_assessments_collection,
    get_claims_collection,
    get_pets_collection,
    get_information_requests_collection,
    db_instance
)
from app.schemas.analytics import (
    PortfolioMetricsSchema,
    RiskDistributionSchema,
    SpeciesBreakdownItemSchema,
    BreedRiskTrendItemSchema,
    ClaimsActivityItemSchema
)

router = APIRouter()

# Test mock store if needed
TEST_METRICS_OVERRIDE: Dict[str, Any] = {}

@router.get("/portfolio", response_model=PortfolioMetricsSchema, tags=["Analytics"])
async def get_portfolio_analytics():
    """
    Compute real-time portfolio metrics across MongoDB Atlas collections:
    - Total underwriting applications
    - Items requiring attention
    - Active claims under review
    - Pending information inquiries
    - Risk tier distribution
    - Species breakdown
    - Breed-level actuarial risk trends
    - Historical monthly claims activity
    """
    if TEST_METRICS_OVERRIDE:
        return PortfolioMetricsSchema(**TEST_METRICS_OVERRIDE)

    if settings.TESTING or not db_instance.is_connected:
        return PortfolioMetricsSchema(
            totalApplications=0,
            requireAttention=0,
            claimsUnderReview=0,
            informationGaps=0,
            riskDistribution=RiskDistributionSchema(low=0, medium=0, high=0),
            claimsActivity=[],
            speciesBreakdown=[],
            breedRiskTrends=[]
        )

    assessments_coll = get_assessments_collection()
    claims_coll = get_claims_collection()
    pets_coll = get_pets_collection()
    info_coll = get_information_requests_collection()

    # 1. Total applications
    total_apps = await assessments_coll.count_documents({})

    # 2. Require attention (status in PENDING or REFER, or high risk)
    require_attention = await assessments_coll.count_documents({
        "$or": [
            {"status": {"$in": ["PENDING", "REFER", "FLAGGED"]}},
            {"riskTier": "HIGH"}
        ]
    })

    # 3. Claims under review
    claims_under_review = await claims_coll.count_documents({
        "status": {"$in": ["SUBMITTED", "IN_REVIEW", "PENDING", "FLAGGED"]}
    })

    # 4. Information gaps
    info_gaps = await info_coll.count_documents({
        "status": {"$in": ["DISPATCHED", "PENDING"]}
    })

    # 5. Risk distribution
    risk_pipeline = [
        {"$group": {"_id": "$riskTier", "count": {"$sum": 1}}}
    ]
    risk_cursor = await assessments_coll.aggregate(risk_pipeline)
    risk_counts = {"LOW": 0, "MODERATE": 0, "HIGH": 0}
    async for doc in risk_cursor:
        tier = str(doc.get("_id", "")).upper()
        count = doc.get("count", 0)
        if tier in ["LOW", "PREFERRED"]:
            risk_counts["LOW"] += count
        elif tier in ["MODERATE", "MEDIUM", "STANDARD"]:
            risk_counts["MODERATE"] += count
        elif tier in ["HIGH", "DECLINED"]:
            risk_counts["HIGH"] += count

    risk_dist = RiskDistributionSchema(
        low=risk_counts["LOW"],
        medium=risk_counts["MODERATE"],
        high=risk_counts["HIGH"]
    )

    # 6. Species breakdown from pets collection
    total_pets = await pets_coll.count_documents({})
    species_breakdown: List[SpeciesBreakdownItemSchema] = []
    if total_pets > 0:
        species_pipeline = [
            {"$group": {"_id": "$species", "count": {"$sum": 1}}}
        ]
        sp_cursor = await pets_coll.aggregate(species_pipeline)
        async for doc in sp_cursor:
            species_name = doc.get("_id") or "Other"
            count = doc.get("count", 0)
            pct = round((count / total_pets) * 100, 1)
            species_breakdown.append(SpeciesBreakdownItemSchema(
                species=species_name,
                percentage=pct,
                count=count
            ))

    # 7. Breed risk trends from assessments
    breed_pipeline = [
        {
            "$group": {
                "_id": "$breed",
                "avgRiskScore": {"$avg": "$riskScore"},
                "sampleSize": {"$sum": 1}
            }
        },
        {"$sort": {"sampleSize": -1}},
        {"$limit": 10}
    ]
    breed_cursor = await assessments_coll.aggregate(breed_pipeline)
    breed_risk_trends: List[BreedRiskTrendItemSchema] = []
    async for doc in breed_cursor:
        breed_name = doc.get("_id")
        if breed_name:
            raw_avg = doc.get("avgRiskScore")
            breed_risk_trends.append(BreedRiskTrendItemSchema(
                breed=breed_name,
                avgRiskScore=round(raw_avg, 2) if raw_avg is not None else 0.0,
                claimRatio=0.0,
                sampleSize=doc.get("sampleSize", 0)
            ))

    # 8. Claims activity (by month if timestamp present)
    claims_activity_pipeline = [
        {
            "$group": {
                "_id": {"$substr": ["$filingDate", 0, 7]},
                "submitted": {"$sum": 1},
                "approved": {"$sum": {"$cond": [{"$eq": ["$status", "APPROVED"]}, 1, 0]}},
                "flagged": {"$sum": {"$cond": [{"$eq": ["$status", "FLAGGED"]}, 1, 0]}},
                "totalPayout": {"$sum": {"$cond": [{"$eq": ["$status", "APPROVED"]}, "$claimedAmountInr", 0]}}
            }
        },
        {"$sort": {"_id": 1}},
        {"$limit": 12}
    ]
    claims_cursor = await claims_coll.aggregate(claims_activity_pipeline)
    claims_activity: List[ClaimsActivityItemSchema] = []
    async for doc in claims_cursor:
        month = doc.get("_id") or "Recent"
        sub = doc.get("submitted", 0)
        app = doc.get("approved", 0)
        flg = doc.get("flagged", 0)
        total_p = doc.get("totalPayout") or 0.0
        avg_p = round(total_p / app, 2) if app > 0 and total_p else 0.0
        claims_activity.append(ClaimsActivityItemSchema(
            month=month,
            submitted=sub,
            approved=app,
            flagged=flg,
            averagePayoutInr=avg_p
        ))

    return PortfolioMetricsSchema(
        totalApplications=total_apps,
        requireAttention=require_attention,
        claimsUnderReview=claims_under_review,
        informationGaps=info_gaps,
        riskDistribution=risk_dist,
        speciesBreakdown=species_breakdown,
        breedRiskTrends=breed_risk_trends,
        claimsActivity=claims_activity
    )

