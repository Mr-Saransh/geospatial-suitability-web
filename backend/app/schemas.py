"""Pydantic response schemas for all API endpoints."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


# ── Health ──────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    package_found: bool
    package_status: str = "healthy"
    package_version: str = "1.0"
    model_id: str = "flood_11_factor_v1"
    source_run_id: int = 56
    factor_count: int = 11
    rating_count: int = 11
    result_count: int = 4
    quality_count: int = 2
    total_published_rasters: int = 28
    boundary_status: str = "available"
    manifest_status: str = "valid"
    layers_count: int = 28


# ── Package metadata ───────────────────────────────────────
class PackageMetadata(BaseModel):
    package_status: str = "healthy"
    package_version: str = "1.0"
    state_name: str = "Himachal Pradesh"
    model_id: str = "flood_11_factor_v1"
    source_run_id: int = 56
    published_at: str = ""
    package_type: str = "Spatial Knowledge Package"
    spec_version: str = "1.0"
    layers_count: int = 28
    rasters_count: int = 28
    vectors_count: int = 1
    factor_count: int = 11
    rating_count: int = 11
    result_count: int = 4
    quality_count: int = 2
    total_published_rasters: int = 28
    boundary_status: str = "available"
    manifest_status: str = "valid"
    scoring_modes: list[str] = [
        "AVAILABLE_EVIDENCE_RENORMALIZED",
        "STRICT_11_OF_11",
    ]
    minimum_valid_criteria: int = 8
    aliases: dict[str, Any] = {}
    reproducibility: dict[str, Any] = {}
    provenance: dict[str, Any] = {}
    validation_status: str = "PASSED"


# ── Model ──────────────────────────────────────────────────
class CriterionWeight(BaseModel):
    criterion_id: str
    weight: float


class ClassificationRange(BaseModel):
    class_value: int
    label: str
    range_min: float
    range_max: float


class ModelSummary(BaseModel):
    model_id: str
    name: str
    criterion_count: int
    consistency_ratio: float


class ModelDetail(BaseModel):
    model_id: str
    name: str
    version: str
    criterion_count: int
    criteria: list[str]
    weights: list[CriterionWeight]
    consistency_ratio: float
    consistency_index: float
    lambda_max: float
    random_index: float
    classification: list[ClassificationRange]
    scoring_modes: list[str] = [
        "AVAILABLE_EVIDENCE_RENORMALIZED",
        "STRICT_11_OF_11",
    ]
    minimum_valid_criteria: int = 8
    metadata: dict[str, Any] = {}


# ── Layers ─────────────────────────────────────────────────
class LayerInfo(BaseModel):
    product_id: str
    display_name: str
    criterion_id: str = ""
    type: str  # FACTOR | RATING | RESULT | QUALITY
    layer_type: str  # factor_raster | rating_raster | result_raster | quality_mask
    category: str  # Hydrological Criteria | Topographic Criteria | Environmental Criteria | Analysis Results | Quality & Coverage
    model: str = "flood_11_factor_v1"
    unit: str = ""
    crs: str = "EPSG:4326"
    resolution: str = "30 m"
    resolution_x: float = 0.0
    resolution_y: float = 0.0
    width: int = 0
    height: int = 0
    bounds: list[float] = []
    nodata_value: str = "nan"
    scoring_mode: Optional[str] = None
    status: str = "published"
    relative_path: str = ""
    alias_of: Optional[str] = None
    valid_pixel_pct: float = 0.0
    description: str = ""
    layer_id: str = ""
    layer_name: str = ""


# ── Point inspection ───────────────────────────────────────
class CriterionInspection(BaseModel):
    criterion: str
    display_name: str
    raw_value: Optional[float] = None
    unit: str = ""
    rating: Optional[float] = None
    weight: float = 0.0
    contribution: Optional[float] = None
    status: str = "VALID"  # VALID | NODATA | OUTSIDE_ANALYSIS_AREA
    nodata_reason: Optional[str] = None
    source: str = ""


class PointInspectionResponse(BaseModel):
    lat: float
    lon: float
    model_id: str
    continuous_score: Optional[float] = None
    classified_value: Optional[float] = None
    class_label: Optional[str] = None
    final_status: str = "VALID"  # VALID | PARTIAL_EVIDENCE | NODATA | OUTSIDE_ANALYSIS_AREA
    evidence_count: int = 11
    evidence_total: int = 11
    missing_criteria: list[str] = []
    scoring_mode: Optional[str] = None
    strict_score: Optional[float] = None
    available_evidence_score: Optional[float] = None
    criteria: list[CriterionInspection]


# ── Statistics ─────────────────────────────────────────────
class ClassDistribution(BaseModel):
    class_value: int
    label: str
    pixel_count: int
    percentage: float
    area_km2: Optional[float] = None


class EvidenceDistributionItem(BaseModel):
    criteria_count: int
    label: str
    pixel_count: int
    percentage: float


class AnalysisStatistics(BaseModel):
    model_id: str
    source_run_id: int = 56
    scoring_mode: str = "AVAILABLE_EVIDENCE_RENORMALIZED"
    total_pixels: int
    valid_pixels: int
    nodata_pixels: int
    valid_coverage_pct: float
    nodata_coverage_pct: float
    score_min: Optional[float] = None
    score_max: Optional[float] = None
    score_mean: Optional[float] = None
    score_std: Optional[float] = None
    class_distribution: list[ClassDistribution]
    evidence_distribution: list[EvidenceDistributionItem] = []
    resolution_m: Optional[float] = None
    crs: str = ""


# ── Analysis metadata ─────────────────────────────────────
class AnalysisMetadata(BaseModel):
    model_id: str
    model_name: str
    model_version: str
    source_run_id: int = 56
    criteria: list[str]
    weights: list[CriterionWeight]
    consistency_ratio: float
    crs: str
    resolution: str
    published_at: str
    state_name: str
    validation_status: str
    scoring_modes: list[str] = [
        "AVAILABLE_EVIDENCE_RENORMALIZED",
        "STRICT_11_OF_11",
    ]
    minimum_valid_criteria: int = 8
    kappa: Optional[str] = None
    kappa_reason: Optional[str] = None
    nodata_value: str = "nan"
    package_type: str = "Spatial Knowledge Package"
    reproducibility: dict[str, Any] = {}
