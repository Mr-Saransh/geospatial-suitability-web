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


_boundary_cache: dict[str, dict] = {}


@router.get("/boundary")
def get_state_boundary():
    """Return the GeoJSON FeatureCollection boundary for the current state."""
    import json
    import logging
    from app.config import settings
    import rasterio

    logger = logging.getLogger(__name__)
    state_name = package_service.state_name
    if state_name in _boundary_cache:
        return _boundary_cache[state_name]

    candidates = [
        package_service.root / "boundary.geojson",
        package_service.root / "boundary.gpkg",
        settings.spatial_knowledge_root.parent / "hp_boundary.gpkg",
        settings.spatial_knowledge_root.parent / f"{state_name.lower().replace(' ', '_')}_boundary.gpkg",
    ]

    for p in candidates:
        if p.exists():
            try:
                import geopandas as gpd
                gdf = gpd.read_file(p)
                if str(gdf.crs) != "EPSG:4326":
                    gdf = gdf.to_crs(epsg=4326)
                gdf["geometry"] = gdf.geometry.simplify(0.002, preserve_topology=True)
                data = json.loads(gdf.to_json())
                _boundary_cache[state_name] = data
                return data
            except Exception as e:
                logger.warning("Failed to load boundary from %s: %s", p, e)

    result_layers = package_service.result_layers()
    if result_layers:
        try:
            path = package_service.get_raster_path(result_layers[0]["relative_path"])
            with rasterio.open(path) as ds:
                from rasterio.warp import transform_bounds
                b = transform_bounds(ds.crs, "EPSG:4326", *ds.bounds)
                data = {
                    "type": "FeatureCollection",
                    "features": [
                        {
                            "type": "Feature",
                            "properties": {"name": state_name},
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [[
                                    [b[0], b[1]],
                                    [b[2], b[1]],
                                    [b[2], b[3]],
                                    [b[0], b[3]],
                                    [b[0], b[1]],
                                ]],
                            },
                        }
                    ],
                }
                _boundary_cache[state_name] = data
                return data
        except Exception:
            pass

    return {"type": "FeatureCollection", "features": []}

