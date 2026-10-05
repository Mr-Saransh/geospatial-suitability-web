"""
AHP / MCDA model configurations and weights registry.

Authoritative sources:
- flood_11_factor_v1: canonical Run #56
- landslide_14_factor_v1: canonical Run #63 Spatial Knowledge Package
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple


@dataclass(frozen=True)
class AHPModelConfig:
    """Immutable model configuration for susceptibility analysis."""

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
        "STRICT",
    )
    metadata: dict[str, Any] = field(default_factory=dict)

    def weight_for(self, criterion: str) -> float:
        try:
            return self.weights[criterion]
        except KeyError:
            raise ValueError(f"No weight for criterion '{criterion}' in model '{self.model_id}'")


# ── Flood 11-factor model — canonical Run #56 ──
FLOOD_AHP = AHPModelConfig(
    model_id="flood_11_factor_v1",
    name="11-Factor Flood Susceptibility AHP",
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
        1: "Very Low Susceptibility",
        2: "Low Susceptibility",
        3: "Moderate Susceptibility",
        4: "High Susceptibility",
        5: "Very High Susceptibility",
    },
    minimum_valid_criteria=8,
    scoring_modes=(
        "AVAILABLE_EVIDENCE_RENORMALIZED",
        "STRICT_11_OF_11",
    ),
    metadata={
        "source": "AHP_Full_Steps_11Factors",
        "source_run_id": 56,
        "method": "Saaty pairwise comparison",
        "criterion": "Flood susceptibility",
        "default_continuous_product_id": "flood_11_factor_v1_available_evidence_suitability",
        "default_classified_product_id": "flood_11_factor_v1_available_evidence_suitability_classified",
        "strict_continuous_product_id": "flood_11_factor_v1_strict_suitability",
        "strict_classified_product_id": "flood_11_factor_v1_strict_suitability_classified",
        "legacy_continuous_alias": "flood_11_factor_v1_full_suitability",
        "legacy_classified_alias": "flood_11_factor_v1_full_suitability_classified",
        "coverage_product_id": "flood_11_factor_v1_valid_criteria_count",
        "bitmask_product_id": "flood_11_factor_v1_missing_criteria_bitmask",
    },
)


# ── Landslide 14-factor model — canonical Run #63 ──
LANDSLIDE_MCDA = AHPModelConfig(
    model_id="landslide_14_factor_v1",
    name="14-Factor Landslide Susceptibility MCDA",
    version="1.0",
    criteria=(
        "slope",
        "lithology",
        "lineament_density",
        "drainage_density",
        "rainfall_10_year",
        "relative_relief",
        "twi",
        "geomorphology",
        "soil",
        "distance_to_faults",
        "distance_to_roads",
        "lulc",
        "aspect",
        "ndvi",
    ),
    weights={
        "slope":               0.23,
        "lithology":           0.15,
        "lineament_density":   0.15,
        "drainage_density":    0.09,
        "rainfall_10_year":    0.08,
        "relative_relief":     0.07,
        "twi":                 0.05,
        "geomorphology":       0.04,
        "soil":                0.04,
        "distance_to_faults":  0.03,
        "distance_to_roads":   0.03,
        "lulc":                0.02,
        "aspect":              0.01,
        "ndvi":                0.01,
    },
    lambda_max=14.0,
    consistency_index=0.0,
    random_index=1.57,
    consistency_ratio=0.0,
    classification_ranges={
        1: (1.0, 3.0),
        2: (3.0, 5.0),
        3: (5.0, 7.0),
        4: (7.0, 9.0),
        5: (9.0, 11.0),
    },
    classification_labels={
        1: "Very Low Susceptibility",
        2: "Low Susceptibility",
        3: "Moderate Susceptibility",
        4: "High Susceptibility",
        5: "Very High Susceptibility",
    },
    minimum_valid_criteria=10,
    scoring_modes=(
        "AVAILABLE_EVIDENCE_RENORMALIZED",
        "STRICT_14_OF_14",
    ),
    metadata={
        "source": "MCDA_14_Factor_Package",
        "source_run_id": 63,
        "method": "Multi-Criteria Decision Analysis (MCDA)",
        "criterion": "Landslide susceptibility",
        "default_continuous_product_id": "landslide_14_factor_v1_available_evidence_suitability",
        "default_classified_product_id": "landslide_14_factor_v1_available_evidence_suitability_classified",
        "strict_continuous_product_id": "landslide_14_factor_v1_strict_suitability",
        "strict_classified_product_id": "landslide_14_factor_v1_strict_suitability_classified",
        "coverage_product_id": "landslide_14_factor_v1_valid_criteria_count",
        "bitmask_product_id": "landslide_14_factor_v1_missing_criteria_bitmask",
    },
)

# Registry of all known models
MODELS_REGISTRY: dict[str, AHPModelConfig] = {
    FLOOD_AHP.model_id: FLOOD_AHP,
    LANDSLIDE_MCDA.model_id: LANDSLIDE_MCDA,
}


def get_model_config(model_id: str) -> Optional[AHPModelConfig]:
    """Retrieve model configuration by ID or normalized name."""
    if not model_id:
        return None
    cleaned = model_id.strip().lower()
    if cleaned in MODELS_REGISTRY:
        return MODELS_REGISTRY[cleaned]
    # Check by substring
    for mid, cfg in MODELS_REGISTRY.items():
        if cleaned in mid.lower() or mid.lower() in cleaned:
            return cfg
    return None
