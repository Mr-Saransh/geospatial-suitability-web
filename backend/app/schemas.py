"""Pydantic response schemas for all API endpoints."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ── Health ──────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    package_found: bool
    package_status: str = "healthy"
    package_version: str = "1.0"
    model_id: str = "flood_11_factor_v1"
    models_available: list[str] = Field(default_factory=list)
    source_run_id: int = 56
    factor_count: int = 11
    rating_count: int = 11
    result_count: int = 4
    quality_count: int = 2
    total_published_rasters: int = 28
    boundary_status: str = "available"
    manifest_status: str = "valid"
    layers_count: int = 28
    ollama_reachable: bool = False
    ollama_status: str = "offline"
    ollama_configured_model: str = ""
    ollama_model_installed: bool = False


# ── Package metadata ───────────────────────────────────────
class PackageMetadata(BaseModel):
    package_status: str = "healthy"
    package_version: str = "1.0"
    state_name: str = "Himachal Pradesh"
    model_id: str = "flood_11_factor_v1"
    models_available: list[str] = Field(default_factory=list)
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
        "STRICT",
    ]
    minimum_valid_criteria: int = 8
    aliases: dict[str, Any] = Field(default_factory=dict)
    reproducibility: dict[str, Any] = Field(default_factory=dict)
    provenance: dict[str, Any] = Field(default_factory=dict)
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
    source_run_id: int | str | None = 56
    publication_date: str | None = "September 2026"
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
        "STRICT",
    ]
    minimum_valid_criteria: int = 8
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── Layers ─────────────────────────────────────────────────
class LayerInfo(BaseModel):
    product_id: str
    display_name: str
    criterion_id: str = ""
    type: str  # FACTOR | RATING | RESULT | QUALITY
    layer_type: str  # factor_raster | rating_raster | result_raster | quality_mask
    category: str  # Hydrological Criteria | Topographic Criteria | Environmental Criteria | Geological Criteria | Analysis Results | Quality & Coverage
    model: str = "flood_11_factor_v1"
    unit: str = ""
    crs: str = "EPSG:4326"
    resolution: str = "30 m"
    resolution_x: float = 0.0
    resolution_y: float = 0.0
    width: int = 0
    height: int = 0
    bounds: list[float] = Field(default_factory=list)
    nodata_value: str = "nan"
    scoring_mode: str | None = None
    status: str = "published"
    relative_path: str = ""
    alias_of: str | None = None
    valid_pixel_pct: float = 0.0
    description: str = ""
    layer_id: str = ""
    layer_name: str = ""


# ── Point inspection ───────────────────────────────────────
class CriterionInspection(BaseModel):
    criterion: str
    display_name: str
    raw_value: float | None = None
    unit: str = ""
    rating: float | None = None
    weight: float = 0.0
    contribution: float | None = None
    status: str = "VALID"  # VALID | NODATA | OUTSIDE_ANALYSIS_AREA
    nodata_reason: str | None = None
    source: str = ""


class PointInspectionResponse(BaseModel):
    lat: float
    lon: float
    model_id: str
    continuous_score: float | None = None
    classified_value: float | None = None
    class_label: str | None = None
    final_status: str = (
        "VALID"  # VALID | PARTIAL_EVIDENCE | NODATA | OUTSIDE_ANALYSIS_AREA
    )
    coverage_status: str | None = "COMPLETE"  # COMPLETE | PARTIAL | UNAVAILABLE
    evidence_count: int = 11
    evidence_total: int = 11
    missing_criteria: list[str] = Field(default_factory=list)
    scoring_mode: str | None = None
    strict_score: float | None = None
    available_evidence_score: float | None = None
    criteria: dict[str, Any] | list[CriterionInspection]
    criteria_list: list[CriterionInspection] | None = None
    location: dict[str, float] | None = None
    model: dict[str, str] | None = None
    final: dict[str, Any] | None = None


# ── Statistics ─────────────────────────────────────────────
class ClassDistribution(BaseModel):
    class_value: int
    label: str
    pixel_count: int
    percentage: float
    area_km2: float | None = None


class EvidenceDistributionItem(BaseModel):
    criteria_count: int
    label: str
    pixel_count: int
    percentage: float


class CoverageDistributionItem(BaseModel):
    status: str
    label: str
    percentage: float
    pixel_count: int | None = None
    color: str | None = None


class AnalysisStatistics(BaseModel):
    model_id: str
    source_run_id: int = 56
    scoring_mode: str = "AVAILABLE_EVIDENCE_RENORMALIZED"
    total_pixels: int
    valid_pixels: int
    nodata_pixels: int
    valid_coverage_pct: float
    nodata_coverage_pct: float
    score_min: float | None = None
    score_max: float | None = None
    score_mean: float | None = None
    score_std: float | None = None
    class_distribution: list[ClassDistribution]
    evidence_distribution: list[EvidenceDistributionItem] = Field(default_factory=list)
    coverage_distribution: list[CoverageDistributionItem] = Field(default_factory=list)
    resolution_m: float | None = None
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
        "STRICT",
    ]
    minimum_valid_criteria: int = 8
    kappa: str | None = None
    kappa_reason: str | None = None
    nodata_value: str = "nan"
    package_type: str = "Spatial Knowledge Package"
    reproducibility: dict[str, Any] = Field(default_factory=dict)


# ── AI Assistant (Evidence-Grounded Local Ollama V2) ───────
class AIChatHistoryItem(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., max_length=1500, description="Message content")


class StructuredEvidenceItem(BaseModel):
    id: str = Field(..., description="Stable evidence identifier (e.g. 'flood:weight:slope')")
    model_id: str = Field(..., description="Model identifier")
    category: str = Field(
        ...,
        description="Category: 'model_metadata' | 'criteria_weights' | 'point_inspection' | 'statistics' | 'model_comparison' | 'limitation'",
    )
    label: str = Field(..., description="Human-readable label")
    value: Any = Field(..., description="Actual measured or computed value")
    unit: str | None = Field(None, description="Physical unit if known (e.g., 'mm/yr', 'm', '%')")
    source: str = Field(..., description="Authoritative source layer, manifest, or service")
    coordinates: dict[str, float] | None = Field(None, description="Optional lat/lon if applicable")
    coverage_status: str | None = Field(None, description="Coverage status if applicable")
    caveats: str | None = Field(None, description="Caveats or notes")


class AIStatusEvent(BaseModel):
    stage: str = Field(..., description="Current operational stage identifier")
    message: str = Field(..., description="Human-readable progress description")
    model_id: str | None = Field(None, description="Active GIS model identifier")
    progress: float | None = Field(None, description="Optional normalized progress (0.0 to 1.0)")


class AIAssistantRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Natural-language geospatial question",
    )
    model_id: str | None = Field(
        None,
        description="Optional model identifier: flood_11_factor_v1 or landslide_14_factor_v1",
    )
    latitude: float | None = Field(
        None,
        ge=-90.0,
        le=90.0,
        description="Optional WGS84 latitude for location-specific inspection",
    )
    longitude: float | None = Field(
        None,
        ge=-180.0,
        le=180.0,
        description="Optional WGS84 longitude for location-specific inspection",
    )
    history: list[AIChatHistoryItem] | None = Field(
        default_factory=list,
        description="Bounded conversation history",
    )


class AIAssistantResponse(BaseModel):
    answer: str
    model_id: str | None = None
    evidence: dict[str, Any] | None = Field(
        default=None,
        description="Structured facts retrieved directly from the backend GIS engine (only when coordinates or data are requested)",
    )
    items: list[StructuredEvidenceItem] = Field(
        default_factory=list,
        description="Auditable atomic evidence items with source provenance and units",
    )
    coverage: str | dict[str, Any] | None = Field(
        None,
        description="Relevant analysis coverage, valid criteria count, or missing-evidence information",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Limitations, boundary warnings, or missing source criteria",
    )
    model_used: str | None = Field(
        None,
        description="Local Ollama model name used for generation, or 'evidence_summary' if offline",
    )
    source: str = Field(
        "ollama",
        description="Execution mode: 'ollama' or 'evidence_fallback'",
    )


class AIHealthResponse(BaseModel):
    status: str = Field(
        ...,
        description="'ready' when model is available, 'no_model_installed' when Ollama is running without model, or 'ollama_offline'",
    )
    ollama_reachable: bool
    ollama_url: str
    configured_model: str
    model_installed: bool
    installed_models: list[str] = Field(default_factory=list)
    setup_guidance: str | None = None

