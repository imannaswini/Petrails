"""
Test Suite for PETRAILS Actuarial Machine Learning Pipeline
Validates:
- Safe ageText parsing and validation
- Model artifact loading from disk
- Real-time RandomForestRegressor inference on 6 independent clinical features
- SHAP TreeExplainer exact mathematical reconciliation (additivity)
- Claims IsolationForest anomaly scoring
"""

import os
import sys
import pytest

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.ml.inference import (
    ml_engine,
    parse_pet_age,
    DEFAULT_FALLBACK_AGE,
    UNDERWRITING_MODEL_PATH,
    CLAIMS_MODEL_PATH
)
from app.services.intelligence_service import predictive_risk_model, claims_anomaly_engine

def test_parse_pet_age_comprehensive():
    """Verify ageText parser handles standard strings, month units, numerics, and invalid fallbacks."""
    # Standard string formats
    assert parse_pet_age({"ageText": "5 years"}) == 5.0
    assert parse_pet_age({"ageText": "3 yrs"}) == 3.0
    assert parse_pet_age({"ageText": "4"}) == 4.0
    
    # Month unit conversion
    assert parse_pet_age({"ageText": "6 months"}) == 0.5
    assert parse_pet_age({"ageText": "18 mo"}) == 1.5
    
    # Numeric values
    assert parse_pet_age({"age": 7}) == 7.0
    assert parse_pet_age({"age": 2.5}) == 2.5
    
    # Missing / None
    assert parse_pet_age({}) == DEFAULT_FALLBACK_AGE
    assert parse_pet_age({"age": None, "ageText": None}) == DEFAULT_FALLBACK_AGE
    
    # Invalid strings fallback
    assert parse_pet_age({"ageText": "unknown age"}) == DEFAULT_FALLBACK_AGE
    assert parse_pet_age({"ageText": ""}) == DEFAULT_FALLBACK_AGE
    
    # Out of bounds fallback [0.1, 25.0]
    assert parse_pet_age({"age": -3}) == DEFAULT_FALLBACK_AGE
    assert parse_pet_age({"age": 150}) == DEFAULT_FALLBACK_AGE

def test_ml_model_artifacts_exist():
    """Verify that serialized scikit-learn models are present on disk."""
    assert os.path.exists(UNDERWRITING_MODEL_PATH), "Underwriting model artifact missing"
    assert os.path.exists(CLAIMS_MODEL_PATH), "Claims anomaly model artifact missing"
    assert ml_engine.underwriting_artifact is not None
    assert ml_engine.claims_artifact is not None
    
    # Verify exactly 6 independent features (no rule_score)
    expected_cols = ["age", "is_canine", "is_high_risk_breed", "weight_kg", "medical_history_count", "vaccination_compliant"]
    assert ml_engine.underwriting_artifact["feature_columns"] == expected_cols

def test_predictive_risk_model_real_inference():
    """Verify genuine ML risk prediction and SHAP calculation."""
    sample = {
        "ageText": "7 years",
        "species": "Dog",
        "breed": "Golden Retriever",
        "weightKg": 32.0,
        "medicalHistory": [{"id": "m1", "event": "Cruciate laxity"}, {"id": "m2", "event": "Otitis"}],
        "vaccinations": [{"status": "Up to Date"}]
    }
    
    score, confidence, shap_factors = predictive_risk_model.predict_risk(sample)
    
    # Assert numerical score bounds
    assert isinstance(score, int)
    assert 10 <= score <= 95
    assert confidence >= 0.85
    
    # Assert SHAP attributions are computed
    assert len(shap_factors) >= 4
    for factor in shap_factors:
        assert isinstance(factor.impact, float)
        assert factor.category in ["Medical History", "Age & Breed", "Vaccination", "Claims", "Geography"]
        assert len(factor.explanation) > 10

def test_shap_mathematical_reconciliation():
    """Verify exact SHAP additivity: base_value + sum(shap_values) == model.predict(X)."""
    import pandas as pd
    import numpy as np
    
    artifact = ml_engine.underwriting_artifact
    model = artifact["model"]
    explainer = artifact["explainer"]
    base_val = artifact["base_value"]
    cols = artifact["feature_columns"]
    
    test_sample = pd.DataFrame([[5.0, 1.0, 1.0, 28.0, 2.0, 1.0]], columns=cols)
    raw_pred = model.predict(test_sample)[0]
    shap_vals = explainer.shap_values(test_sample)[0]
    
    reconciled_sum = base_val + np.sum(shap_vals)
    delta = abs(raw_pred - reconciled_sum)
    
    # Additive property must hold within numerical float precision
    assert delta < 1e-4, f"SHAP additivity violated: pred={raw_pred}, sum={reconciled_sum}"

def test_senior_high_risk_scores_higher_than_young():
    """Ensure ML model differentiates senior predisposed canine from healthy young dog."""
    young_healthy = {
        "ageText": "1 year",
        "species": "Dog",
        "breed": "Indie / Mixed",
        "weightKg": 16.0,
        "medicalHistory": [],
        "vaccinations": [{"status": "Up to Date"}]
    }
    
    senior_high_risk = {
        "ageText": "9 years",
        "species": "Dog",
        "breed": "Golden Retriever",
        "weightKg": 34.0,
        "medicalHistory": [{"id": "m1"}, {"id": "m2"}, {"id": "m3"}],
        "vaccinations": []
    }
    
    score_young, _, _ = predictive_risk_model.predict_risk(young_healthy)
    score_senior, _, _ = predictive_risk_model.predict_risk(senior_high_risk)
    
    assert score_senior > score_young
    assert score_young <= 50
    assert score_senior >= 60

def test_claims_anomaly_isolation_forest():
    """Verify real claims anomaly scoring identifies overbilled claims."""
    normal_claim = {
        "amountInr": 15000.0,
        "invoiceDetails": {
            "procedureCodes": ["VET-DX-01"],
            "standardMarketRangeInr": [12000.0, 20000.0]
        }
    }
    
    elevated_claim = {
        "amountInr": 65000.0,
        "invoiceDetails": {
            "procedureCodes": ["VET-DX-01", "VET-SRG-02", "VET-EXTRA"],
            "standardMarketRangeInr": [12000.0, 20000.0]
        }
    }
    
    norm_score, norm_level, norm_ind = claims_anomaly_engine.evaluate_claim(normal_claim)
    ele_score, ele_level, ele_ind = claims_anomaly_engine.evaluate_claim(elevated_claim)
    
    assert norm_score < ele_score
    assert ele_level in ["MODERATE CONCERN", "ELEVATED CONCERN"]
    assert any(i.status in ["Moderate", "Elevated"] for i in ele_ind)
