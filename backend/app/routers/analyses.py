"""Point inspection and statistics endpoints."""
from fastapi import APIRouter, HTTPException, Query

from app.services.raster_service import point_inspection, compute_statistics
from app.services.weights import MODELS_REGISTRY
from app.schemas import PointInspectionResponse, AnalysisStatistics

router = APIRouter(prefix="/api/v1", tags=["analyses"])


@router.get("/analyses/{analysis_id}/point", response_model=PointInspectionResponse)
def inspect_point(
    analysis_id: str,
    lat: float = Query(..., ge=-90, le=90, description="Latitude (WGS84)"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude (WGS84)"),
):
    """
    Sample all rasters at the given coordinates.
    Returns raw values, ratings, weights, contributions, and final result.
    """
    if analysis_id not in MODELS_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Model '{analysis_id}' not found")

    result = point_inspection(analysis_id, lat, lon)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return PointInspectionResponse(**result)


@router.get("/analyses/{analysis_id}/statistics", response_model=AnalysisStatistics)
def get_statistics(analysis_id: str):
    """
    Compute and return statistics for the analysis result rasters.
    Results are cached after first computation.
    """
    if analysis_id not in MODELS_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Model '{analysis_id}' not found")

    result = compute_statistics(analysis_id)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return AnalysisStatistics(**result)
