"""
AHP weights for the flood_11_factor_v1 model.

Authoritative source: geo_engine/ahp/flood_config.py in the scientific engine (Run #56).
These values are READ-ONLY copies used by the API for inspection and model responses.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Tuple


@dataclass(frozen=True)
class AHPModelConfig:
    """Immutable AHP model configuration."""

    model_id: str
    name: str
    version: str
    criteria: tuple[str, ...]
    weights: dict[str, float]
    consistency_ratio: float
    consistency_index: float
    lambda_max: float
    random_index: float
    classification_ranges: dict[int, tuple[float, float]]
    classification_labels: dict[int, str]
    minimum_valid_criteria: int = 8
    scoring_modes: tuple[str, ...] = (
        "AVAILABLE_EVIDENCE_RENORMALIZED",
        "STRICT_11_OF_11",
    )
    metadata: dict[str, str] = field(default_factory=dict)

    def weight_for(self, criterion: str) -> float:
        try:
            return self.weights[criterion]
        except KeyError:
            raise ValueError(f"No AHP weight for criterion: {criterion}")


# ── Flood 11-factor model — canonical Run #56 ──

FLOOD_AHP = AHPModelConfig(
    model_id="flood_11_factor_v1",
    name="11-Factor Flood Suitability AHP",
    version="1.0",

    criteria=(
        "rainfall",
        "slope",
        "flow_accumulation",
        "distance_to_rivers",
        "twi",
        "drainage_density",
        "elevation",
        "lulc",
        "curvature",
        "soil",
        "ndvi",
    ),

    weights={
        "rainfall":            0.132592101878827,
        "slope":               0.230587976569696,
        "flow_accumulation":   0.111537859706376,
        "distance_to_rivers":  0.148020730048277,
        "twi":                 0.142168213466147,
        "drainage_density":    0.0667581536527979,
        "elevation":           0.0345206594435582,
        "lulc":                0.0572818244236022,
        "curvature":           0.0281789133881518,
        "soil":                0.0317296439597403,
        "ndvi":                0.0166239234628261,
    },

    lambda_max=11.238356826786,
    consistency_index=0.0238356826785981,
    random_index=1.51,
    consistency_ratio=0.0157852203169524,

    classification_ranges={
        1: (1.0, 1.8),
        2: (1.8, 2.6),
        3: (2.6, 3.4),
        4: (3.4, 4.2),
        5: (4.2, 5.0),
    },

    classification_labels={
        1: "Very Low",
        2: "Low",
        3: "Moderate",
        4: "High",
        5: "Very High",
    },

    minimum_valid_criteria=8,
    scoring_modes=(
        "AVAILABLE_EVIDENCE_RENORMALIZED",
        "STRICT_11_OF_11",
    ),

    metadata={
        "source": "AHP_Full_Steps_11Factors",
        "source_run_id": "56",
        "method": "Saaty pairwise comparison",
        "criterion": "Flood suitability",
        "default_continuous_product_id": "flood_11_factor_v1_available_evidence_suitability",
        "default_classified_product_id": "flood_11_factor_v1_available_evidence_suitability_classified",
        "strict_continuous_product_id": "flood_11_factor_v1_strict_suitability",
        "strict_classified_product_id": "flood_11_factor_v1_strict_suitability_classified",
        "legacy_continuous_alias": "flood_11_factor_v1_full_suitability",
        "legacy_classified_alias": "flood_11_factor_v1_full_suitability_classified",
    },
)

# Registry of all known models
MODELS_REGISTRY: dict[str, AHPModelConfig] = {
    FLOOD_AHP.model_id: FLOOD_AHP,
}
