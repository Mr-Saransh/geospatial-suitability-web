"""Point inspection and statistics endpoints."""

import math
import re
from fastapi import APIRouter, HTTPException, Query

from app.schemas import AnalysisStatistics, PointInspectionResponse
from app.services.raster_service import compute_statistics, point_inspection
from app.services.weights import get_model_config

router = APIRouter(prefix="/api/v1", tags=["analyses"])

_MODEL_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")


def _validate_model_id(model_id: str) -> str:
    """Validate model_id against injection and format constraints."""
    cleaned = model_id.strip()
    if not cleaned or len(cleaned) > 64 or not _MODEL_ID_PATTERN.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Invalid model identifier format.",
        )
    return cleaned


@router.get("/analyses/{model_id}/point", response_model=PointInspectionResponse)
def inspect_point(
    model_id: str,
    lat: float = Query(..., ge=-90, le=90, description="Latitude (WGS84)"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude (WGS84)"),
):
    """
    Sample all rasters at the given coordinates for the specified model.
    Returns raw values, ratings, weights, contributions, and final result.
    Enforces strict numeric range and NaN/Inf validation.
    """
    safe_model_id = _validate_model_id(model_id)

    if math.isnan(lat) or math.isinf(lat) or math.isnan(lon) or math.isinf(lon):
        raise HTTPException(
            status_code=400,
            detail="Latitude and longitude must be finite numeric values.",
        )

    model_cfg = get_model_config(safe_model_id)
    if not model_cfg:
        raise HTTPException(status_code=404, detail=f"Model '{safe_model_id}' not found")

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
    safe_model_id = _validate_model_id(model_id)
    model_cfg = get_model_config(safe_model_id)
    if not model_cfg:
        raise HTTPException(status_code=404, detail=f"Model '{safe_model_id}' not found")

    result = compute_statistics(model_cfg.model_id)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return AnalysisStatistics(**result)
