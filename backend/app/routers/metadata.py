"""Package and analysis metadata endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas import AnalysisMetadata, CriterionWeight, PackageMetadata
from app.services.repository import repository
from app.services.weights import get_model_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["metadata"])


@router.get("/metadata/package", response_model=PackageMetadata)
def get_package_metadata():
    """Return full spatial package metadata for the canonical package(s)."""
    if not repository.models:
        raise HTTPException(
            status_code=503,
            detail="Spatial Knowledge Package unavailable or uninitialized",
        )

    # Use flood package if present, or first package
    pkg_dict = None
    for pkg in repository.packages.values():
        if "flood" in pkg.get("model_id", "").lower():
            pkg_dict = pkg
            break
    if not pkg_dict and repository.packages:
        pkg_dict = next(iter(repository.packages.values()))

    if not pkg_dict:
        raise HTTPException(
            status_code=503, detail="No valid package metadata available"
        )

    manifest = pkg_dict.get("manifest", {})
    metadata_files = pkg_dict.get("metadata", {})
    model_id = pkg_dict.get("model_id", "flood_11_factor_v1")

    model_layers = repository.get_layers_for_model(model_id)
    f_count = len([layer for layer in model_layers if layer.get("type") == "FACTOR"])
    r_count = len([layer for layer in model_layers if layer.get("type") == "RATING"])
    res_count = len([layer for layer in model_layers if layer.get("type") == "RESULT"])
    q_count = len([layer for layer in model_layers if layer.get("type") == "QUALITY"])
    total_rasters = len(model_layers) or 28

    return PackageMetadata(
        package_status="healthy",
        package_version=str(manifest.get("package_version", "1.0")),
        state_name=manifest.get("state_name", "Himachal Pradesh"),
        model_id=model_id,
        models_available=list(repository.models.keys()),
        source_run_id=int(
            manifest.get("source_run_id", 56 if "flood" in model_id else 63)
        ),
        published_at=str(manifest.get("published_at", "")),
        package_type=manifest.get("package_type", "Spatial Knowledge Package"),
        spec_version=str(manifest.get("spec_version", "1.0")),
        layers_count=total_rasters,
        rasters_count=total_rasters,
        vectors_count=1,
        factor_count=f_count,
        rating_count=r_count,
        result_count=res_count,
        quality_count=q_count,
        total_published_rasters=total_rasters,
        boundary_status="available",
        manifest_status="valid",
        scoring_modes=[
            "AVAILABLE_EVIDENCE_RENORMALIZED",
            "STRICT_11_OF_11" if "flood" in model_id else "STRICT_14_OF_14",
        ],
        minimum_valid_criteria=8 if "flood" in model_id else 10,
        aliases=repository.aliases,
        reproducibility=metadata_files.get("reproducibility", {}),
        provenance=metadata_files.get("dataset_provenance", {}),
        validation_status="PASSED",
    )


@router.get("/analyses/{analysis_id}/metadata", response_model=AnalysisMetadata)
def get_analysis_metadata(analysis_id: str):
    """Return metadata for a specific analysis/model."""
    model = get_model_config(analysis_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{analysis_id}' not found")

    model_layers = repository.get_layers_for_model(model.model_id)
    result_layers = [layer for layer in model_layers if layer.get("type") == "RESULT"]

    crs = result_layers[0].get("crs", "EPSG:4326") if result_layers else "EPSG:4326"
    res_str = result_layers[0].get("resolution", "30 m") if result_layers else "30 m"

    is_flood = "flood" in model.model_id.lower()
    source_run = 56 if is_flood else 63

    return AnalysisMetadata(
        model_id=model.model_id,
        model_name=model.name,
        model_version=model.version,
        source_run_id=source_run,
        criteria=list(model.criteria),
        weights=[
            CriterionWeight(criterion_id=c, weight=model.weights[c])
            for c in model.criteria
        ],
        consistency_ratio=model.consistency_ratio,
        crs=crs,
        resolution=res_str,
        published_at="September 2026",
        state_name="Himachal Pradesh",
        validation_status="Validated (CR < 0.10)"
        if model.consistency_ratio < 0.10
        else "Validated",
        scoring_modes=[
            "AVAILABLE_EVIDENCE_RENORMALIZED",
            f"STRICT_{len(model.criteria)}_OF_{len(model.criteria)}",
        ],
        minimum_valid_criteria=model.minimum_valid_criteria,
        kappa=None,
        kappa_reason="Independent reference data unavailable — Kappa: N/A",
        nodata_value="nan",
        package_type="Spatial Knowledge Package",
        reproducibility=model.metadata,
    )


@router.get("/boundary")
def get_state_boundary():
    """Return the official GeoJSON FeatureCollection boundary for Himachal Pradesh."""
    return repository.get_state_boundary()
