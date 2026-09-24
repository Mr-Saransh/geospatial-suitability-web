"""Health endpoint."""
from fastapi import APIRouter
from app.config import settings
from app.services.package_service import package_service
from app.schemas import HealthResponse

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health():
    """
    Check backend and spatial package status.
    Never exposes local Windows filesystem paths to public clients.
    """
    pkg_exists = settings.spatial_knowledge_root.exists()
    manifest_exists = (settings.spatial_knowledge_root / "manifest.json").exists()
    is_healthy = pkg_exists and manifest_exists and len(package_service.layers) == 28

    return HealthResponse(
        status="healthy" if is_healthy else ("degraded" if pkg_exists else "unhealthy"),
        package_found=pkg_exists,
        package_status="healthy" if is_healthy else "missing_or_incomplete",
        package_version=package_service.package_version if is_healthy else "unknown",
        model_id=package_service.model_id if is_healthy else "unknown",
        source_run_id=package_service.source_run_id if is_healthy else 0,
        factor_count=package_service.factor_count if is_healthy else 0,
        rating_count=package_service.rating_count if is_healthy else 0,
        result_count=package_service.result_count if is_healthy else 0,
        quality_count=package_service.quality_count if is_healthy else 0,
        total_published_rasters=package_service.total_published_rasters if is_healthy else 0,
        boundary_status="available" if is_healthy else "unavailable",
        manifest_status="valid" if manifest_exists else "missing",
        layers_count=len(package_service.layers),
    )
