"""
PETRAILS Actuarial Intelligence Service Layer
Provides clean interfaces and baseline deterministic algorithms for:
- Underwriting Rule Engine
- Predictive Risk Model & SHAP Factor Attribution
- Claims Anomaly Detection Engine
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Tuple
from app.schemas.assessment import ShapFactorSchema
from app.schemas.claim import AnomalyIndicatorSchema
from app.ml.inference import ml_engine

class IUnderwritingRuleEngine(ABC):
    @abstractmethod
    def evaluate_rules(self, pet_data: Dict[str, Any]) -> Tuple[int, List[Dict[str, Any]]]:
        """Calculates rule-based actuarial score (0-100) and triggered underwriting rules."""
        pass

class IPredictiveRiskModel(ABC):
    @abstractmethod
    def predict_risk(self, feature_vector: Dict[str, Any]) -> Tuple[int, float, List[ShapFactorSchema]]:
        """
        Executes ML predictive risk scoring model interface.
        Returns:
            - ml_score: int (0-100)
            - model_confidence: float (0.0-1.0)
            - shap_factors: List[ShapFactorSchema] (SHAP explainability feature attributions)
        """
        pass

class IClaimsAnomalyEngine(ABC):
    @abstractmethod
    def evaluate_claim(self, claim_data: Dict[str, Any]) -> Tuple[int, str, List[AnomalyIndicatorSchema]]:
        """
        Evaluates claims against regional fee benchmarks and consistency checks.
        Returns:
            - anomaly_score: int (0-100)
            - anomaly_level: 'LOW CONCERN' | 'MODERATE CONCERN' | 'ELEVATED CONCERN'
            - indicators: List[AnomalyIndicatorSchema]
        """
        pass

class ActuarialUnderwritingRuleEngine(IUnderwritingRuleEngine):
    """
    Guidewire Actuarial Baseline Rules Engine:
    Applies deterministic baseline insurance guidelines based on species, breed susceptibility,
    age transitions, and declared clinical history.
    """
    def evaluate_rules(self, pet_data: Dict[str, Any]) -> Tuple[int, List[Dict[str, Any]]]:
        base_score = 40
        triggered = []

        raw_age = pet_data.get("ageYears")
        if raw_age is None:
            raw_age = pet_data.get("age")
        age = float(raw_age if raw_age is not None else 2)
        breed = pet_data.get("breed", "Mixed")
        species = pet_data.get("species", "Dog")
        medical_history = pet_data.get("medicalHistory", [])

        # Age transitions
        if age >= 7:
            base_score += 15
            triggered.append({"rule": "RULE-AGE-SENIOR", "impact": 15, "reason": "Senior life-stage hazard", "condition": "age >= 7 years", "inputValue": age})
        elif age >= 4:
            base_score += 8
            triggered.append({"rule": "RULE-AGE-ADULT", "impact": 8, "reason": "Mature adult transition", "condition": "age >= 4 years", "inputValue": age})

        # High susceptibility breeds
        high_risk_canine = ["Golden Retriever", "German Shepherd", "French Bulldog", "Bulldog", "Rottweiler"]
        if species == "Dog" and breed in high_risk_canine:
            base_score += 12
            triggered.append({"rule": "RULE-BREED-PREDISPOSITION", "impact": 12, "reason": f"High actuarial risk profile for {breed}", "condition": "species is Dog and breed is in configured breed list", "inputValue": breed})

        # Declared clinical events
        if medical_history:
            history_penalty = min(len(medical_history) * 6, 24)
            base_score += history_penalty
            triggered.append({"rule": "RULE-CLINICAL-HISTORY", "impact": history_penalty, "reason": f"{len(medical_history)} prior medical events declared", "condition": "medical history record count > 0", "inputValue": len(medical_history)})

        final_score = max(10, min(95, base_score))
        return final_score, triggered

class PredictiveRiskModel(IPredictiveRiskModel):
    """
    Predictive Model Interface & SHAP Attribution Calculator:
    Executes trained scikit-learn RandomForestRegressor model and SHAP TreeExplainer.
    """
    def predict_risk(self, feature_vector: Dict[str, Any]) -> Tuple[int, float, List[ShapFactorSchema]]:
        result = ml_engine.predict_underwriting_risk(feature_vector)
        self.last_inference_mode = ml_engine.last_inference_metadata.get("mode", "UNAVAILABLE")
        self.last_model_version = ml_engine.last_inference_metadata.get("version")
        self.last_shap_base_value = ml_engine.last_inference_metadata.get("base_value")
        self.last_unknown_inputs = ml_engine.last_inference_metadata.get("unknown_inputs", [])
        self.last_model_available = ml_engine.last_inference_metadata.get("model_available", False)
        return result

class ClaimsAnomalyEngine(IClaimsAnomalyEngine):
    """
    Claims Intelligence and Anomaly Engine:
    Executes trained scikit-learn IsolationForest model combined with regional fee benchmarks.
    """
    def evaluate_claim(self, claim_data: Dict[str, Any]) -> Tuple[int, str, List[AnomalyIndicatorSchema]]:
        return ml_engine.predict_claims_anomaly(claim_data)

# Singleton engine instances
underwriting_rule_engine = ActuarialUnderwritingRuleEngine()
predictive_risk_model = PredictiveRiskModel()
claims_anomaly_engine = ClaimsAnomalyEngine()

