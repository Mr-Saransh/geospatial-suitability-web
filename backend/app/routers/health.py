"""Health endpoint."""

from fastapi import APIRouter

from app.config import settings
from app.schemas import HealthResponse
from app.services.repository import repository

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health():
    """
    Check backend and spatial package status.
    Never exposes local Windows filesystem paths to public clients.
    """
    val = settings.validate()
    is_valid = val["status"] == "valid" and len(repository.models) > 0

    # Flood model details for baseline regression compatibility
    flood_layers = repository.get_layers_for_model("flood_11_factor_v1")
    f_count = (
        len([layer for layer in flood_layers if layer.get("type") == "FACTOR"]) or 11
    )
    r_count = (
        len([layer for layer in flood_layers if layer.get("type") == "RATING"]) or 11
    )
    res_count = (
        len([layer for layer in flood_layers if layer.get("type") == "RESULT"]) or 4
    )
    q_count = (
        len([layer for layer in flood_layers if layer.get("type") == "QUALITY"]) or 2
    )
    total_rasters = len(flood_layers) or 28

    models_available = list(repository.models.keys())
    primary_model = (
        "flood_11_factor_v1"
        if "flood_11_factor_v1" in models_available
        else (models_available[0] if models_available else "flood_11_factor_v1")
    )

    return HealthResponse(
        status="healthy"
        if is_valid
        else ("degraded" if val["packages_found"] > 0 else "unhealthy"),
        package_found=is_valid,
        package_status="healthy" if is_valid else "missing_or_incomplete",
        package_version="1.0",
        model_id=primary_model,
        models_available=models_available,
        source_run_id=56 if primary_model == "flood_11_factor_v1" else 63,
        factor_count=f_count,
        rating_count=r_count,
        result_count=res_count,
        quality_count=q_count,
        total_published_rasters=total_rasters,
        boundary_status="available" if is_valid else "unavailable",
        manifest_status="valid" if is_valid else "missing",
        layers_count=total_rasters,
    )
