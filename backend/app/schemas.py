"""Pydantic response schemas for all API endpoints."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


# ── Health ──────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    package_found: bool
    package_path: str
    model_id: Optional[str] = None
    layers_count: int = 0


# ── Package metadata ───────────────────────────────────────
class PackageMetadata(BaseModel):
    state_name: str
    model_id: str
    published_at: str
    package_type: str
    spec_version: str
    layers_count: int
    rasters_count: int
    vectors_count: int
    reproducibility: dict[str, Any] = {}
    provenance: dict[str, Any] = {}


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
    metadata: dict[str, Any] = {}


# ── Layers ─────────────────────────────────────────────────
class LayerInfo(BaseModel):
    layer_id: str
    layer_name: str
    layer_type: str  # factor_raster | rating_raster | result_raster
    criterion_id: str
    model_id: str
    crs: str
    resolution_x: float
    resolution_y: float
    width: int
    height: int
    nodata_value: str
    valid_pixel_pct: float
    description: str
    relative_path: str


# ── Point inspection ───────────────────────────────────────
class CriterionInspection(BaseModel):
    criterion: str
    raw_value: Optional[float] = None
    unit: str = ""
    rating: Optional[float] = None
    weight: float = 0.0
    contribution: Optional[float] = None
    status: str = "VALID"  # VALID | NODATA
    nodata_reason: Optional[str] = None
    source: str = ""


class PointInspectionResponse(BaseModel):
    lat: float
    lon: float
    model_id: str
    continuous_score: Optional[float] = None
    classified_value: Optional[float] = None
    class_label: Optional[str] = None
    final_status: str = "VALID"
    criteria: list[CriterionInspection]


# ── Statistics ─────────────────────────────────────────────
class ClassDistribution(BaseModel):
    class_value: int
    label: str
    pixel_count: int
    percentage: float
    area_km2: Optional[float] = None


class AnalysisStatistics(BaseModel):
    model_id: str
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
    resolution_m: Optional[float] = None
    crs: str = ""


# ── Analysis metadata ─────────────────────────────────────
class AnalysisMetadata(BaseModel):
    model_id: str
    model_name: str
    model_version: str
    criteria: list[str]
    weights: list[CriterionWeight]
    consistency_ratio: float
    crs: str
    resolution: str
    published_at: str
    state_name: str
    validation_status: str
    kappa: Optional[str] = None
    kappa_reason: Optional[str] = None
    nodata_value: str
    package_type: str
    reproducibility: dict[str, Any] = {}
