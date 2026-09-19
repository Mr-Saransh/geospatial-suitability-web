"""Package and analysis metadata endpoints."""
from fastapi import APIRouter
from app.services.package_service import package_service
from app.services.weights import MODELS_REGISTRY
from app.schemas import PackageMetadata, AnalysisMetadata, CriterionWeight

router = APIRouter(prefix="/api/v1", tags=["metadata"])


@router.get("/metadata/package", response_model=PackageMetadata)
def get_package_metadata():
    """Return full spatial package metadata."""
    return PackageMetadata(
        state_name=package_service.state_name,
        model_id=package_service.model_id,
        published_at=package_service.published_at,
        package_type=package_service.manifest.get("package_type", ""),
        spec_version=package_service.manifest.get("spec_version", ""),
        layers_count=package_service.manifest.get("layers_count", 0),
        rasters_count=package_service.manifest.get("rasters_count", 0),
        vectors_count=package_service.manifest.get("vectors_count", 0),
        reproducibility=package_service.reproducibility,
        provenance=package_service.provenance,
    )


@router.get("/analyses/{analysis_id}/metadata", response_model=AnalysisMetadata)
def get_analysis_metadata(analysis_id: str):
    """Return metadata for a specific analysis/model."""
    model = MODELS_REGISTRY.get(analysis_id)
    if not model:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Model {analysis_id} not found")

    # Determine CRS/resolution from first result layer
    result_layers = package_service.result_layers()
    crs = result_layers[0].get("crs", "") if result_layers else ""
    res_x = result_layers[0].get("resolution_x", 0) if result_layers else 0
    res_str = f"{res_x}" if res_x > 1 else f"~{round(res_x * 111320, 1)} m"

    return AnalysisMetadata(
        model_id=model.model_id,
        model_name=model.name,
        model_version=model.version,
        criteria=list(model.criteria),
        weights=[
            CriterionWeight(criterion_id=c, weight=model.weights[c])
            for c in model.criteria
        ],
        consistency_ratio=model.consistency_ratio,
        crs=crs,
        resolution=res_str,
        published_at=package_service.published_at,
        state_name=package_service.state_name,
        validation_status="Validated" if model.consistency_ratio < 0.10 else "Inconsistent",
        kappa=None,
        kappa_reason="Independent reference data unavailable",
        nodata_value="nan",
        package_type=package_service.manifest.get("package_type", ""),
        reproducibility=package_service.reproducibility,
    )
