"""Point inspection and statistics endpoints."""
from fastapi import APIRouter, HTTPException, Query

from app.services.raster_service import point_inspection, compute_statistics
from app.services.weights import get_model_config
from app.schemas import PointInspectionResponse, AnalysisStatistics

router = APIRouter(prefix="/api/v1", tags=["analyses"])


@router.get("/analyses/{model_id}/point", response_model=PointInspectionResponse)
def inspect_point(
    model_id: str,
    lat: float = Query(..., ge=-90, le=90, description="Latitude (WGS84)"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude (WGS84)"),
):
    """
    Sample all rasters at the given coordinates for the specified model.
    Returns raw values, ratings, weights, contributions, and final result.
    """
    model_cfg = get_model_config(model_id)
    if not model_cfg:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    result = point_inspection(model_cfg.model_id, lat, lon)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return PointInspectionResponse(**result)


@router.get("/analyses/{model_id}/statistics", response_model=AnalysisStatistics)
def get_statistics(model_id: str):
    """
    Compute and return statistics for the analysis result rasters.
    Results are cached after first computation.
    """
    model_cfg = get_model_config(model_id)
    if not model_cfg:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")

    result = compute_statistics(model_cfg.model_id)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return AnalysisStatistics(**result)
