"""Health endpoint."""
from fastapi import APIRouter
from app.config import settings
from app.services.package_service import package_service
from app.schemas import HealthResponse

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health():
    """Check backend and spatial package status."""
    pkg_exists = settings.spatial_knowledge_root.exists()
    return HealthResponse(
        status="ok" if pkg_exists else "degraded",
        package_found=pkg_exists,
        package_path=str(settings.spatial_knowledge_root),
        model_id=package_service.model_id if pkg_exists else None,
        layers_count=len(package_service.layers),
    )
