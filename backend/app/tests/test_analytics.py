import sys
import os
from pathlib import Path
import pytest

backend_dir = str(Path(__file__).resolve().parent.parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.schemas.analytics import (
    PortfolioMetricsSchema,
    RiskDistributionSchema,
    SpeciesBreakdownItemSchema,
    BreedRiskTrendItemSchema,
    ClaimsActivityItemSchema
)
from app.api.routes_analytics import get_portfolio_analytics, TEST_METRICS_OVERRIDE

def run_sync(coro):
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

@pytest.fixture(autouse=True)
def clean_test_override():
    TEST_METRICS_OVERRIDE.clear()

def test_analytics_schemas_validation():
    """Verify that portfolio metrics schemas accurately reflect analytics contracts."""
    metrics = PortfolioMetricsSchema(
        totalApplications=12,
        requireAttention=3,
        claimsUnderReview=4,
        informationGaps=2,
        riskDistribution=RiskDistributionSchema(low=5, medium=4, high=3),
        claimsActivity=[
            ClaimsActivityItemSchema(
                month="2026-10",
                submitted=8,
                approved=6,
                flagged=2,
                averagePayoutInr=18500.0
            )
        ],
        speciesBreakdown=[
            SpeciesBreakdownItemSchema(species="Dog", percentage=70.0, count=7),
            SpeciesBreakdownItemSchema(species="Cat", percentage=30.0, count=3)
        ],
        breedRiskTrends=[
            BreedRiskTrendItemSchema(breed="German Shepherd", avgRiskScore=48.5, claimRatio=0.15, sampleSize=5)
        ]
    )

    data = metrics.model_dump()
    assert data["totalApplications"] == 12
    assert data["riskDistribution"]["low"] == 5
    assert len(data["claimsActivity"]) == 1
    assert data["speciesBreakdown"][0]["species"] == "Dog"
    assert data["breedRiskTrends"][0]["avgRiskScore"] == 48.5

def test_get_portfolio_analytics_default_state():
    """Verify default analytics return valid empty/zero metrics in test isolation."""
    result = run_sync(get_portfolio_analytics())
    assert isinstance(result, PortfolioMetricsSchema)
    assert result.totalApplications == 0
    assert result.requireAttention == 0
    assert result.claimsUnderReview == 0
    assert result.informationGaps == 0
    assert result.riskDistribution.low == 0
    assert result.riskDistribution.medium == 0
    assert result.riskDistribution.high == 0
    assert isinstance(result.claimsActivity, list)
    assert isinstance(result.speciesBreakdown, list)
    assert isinstance(result.breedRiskTrends, list)

def test_get_portfolio_analytics_with_data_override():
    """Verify portfolio analytics endpoint correctly parses aggregated datasets."""
    TEST_METRICS_OVERRIDE.update({
        "totalApplications": 25,
        "requireAttention": 5,
        "claimsUnderReview": 7,
        "informationGaps": 3,
        "riskDistribution": {"low": 15, "medium": 7, "high": 3},
        "claimsActivity": [
            {"month": "2026-10", "submitted": 10, "approved": 8, "flagged": 2, "averagePayoutInr": 15000.0}
        ],
        "speciesBreakdown": [
            {"species": "Canine", "percentage": 80.0, "count": 20}
        ],
        "breedRiskTrends": [
            {"breed": "Golden Retriever", "avgRiskScore": 32.0, "claimRatio": 0.05, "sampleSize": 8}
        ]
    })
    result = run_sync(get_portfolio_analytics())
    assert isinstance(result, PortfolioMetricsSchema)
    assert result.totalApplications == 25
    assert result.riskDistribution.low == 15
    assert len(result.speciesBreakdown) == 1
    assert result.speciesBreakdown[0].species == "Canine"

