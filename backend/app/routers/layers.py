"""Layer catalog and tile serving endpoints."""

import re
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.schemas import LayerInfo
from app.services.raster_service import render_tile
from app.services.repository import repository

router = APIRouter(prefix="/api/v1", tags=["layers"])

# Safe identifier pattern allowing alphanumeric, underscores, hyphens, colons, slashes, and periods
_LAYER_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_.:/-]+$")


def _sanitize_layer_id(layer_id: str) -> str:
    """Validate layer_id against length limits, path traversal, and malicious patterns."""
    if not layer_id:
        raise HTTPException(status_code=400, detail="Layer identifier cannot be empty.")
    cleaned = layer_id.strip()
    if len(cleaned) > 128:
        raise HTTPException(status_code=400, detail="Layer identifier exceeds maximum length of 128 characters.")
    if ".." in cleaned or "\\" in cleaned or "\x00" in cleaned:
        raise HTTPException(status_code=400, detail="Invalid layer identifier: path traversal sequences are strictly prohibited.")
    if not _LAYER_ID_PATTERN.match(cleaned):
        raise HTTPException(status_code=400, detail="Invalid layer identifier: contains unsupported characters.")
    return cleaned


@router.get("/layers", response_model=list[LayerInfo])
def list_layers(
    model_id: str | None = Query(
        None,
        description="Filter layers by model ID (e.g. 'flood_11_factor_v1', 'landslide_14_factor_v1', or 'all'). Defaults to primary model.",
    ),
):
    """
    List available raster layers from the canonical spatial package.
    Returns rich semantic metadata, unique display names, and categories.
    """
    if model_id == "all":
        selected_layers = repository.layers
    elif model_id:
        selected_layers = repository.get_layers_for_model(model_id)
        if not selected_layers:
            raise HTTPException(
                status_code=404, detail=f"No layers found for model '{model_id}'"
            )
    else:
        # Default: Return primary model layers (flood_11_factor_v1 for backward compatibility)
        flood_layers = repository.get_layers_for_model("flood_11_factor_v1")
        if flood_layers:
            selected_layers = flood_layers
        else:
            selected_layers = repository.layers

    return [LayerInfo(**layer) for layer in selected_layers]


@router.get("/layers/{layer_id:path}", response_model=LayerInfo)
def get_layer(
    layer_id: str,
    model_id: str | None = Query(
        None, description="Optional model ID to disambiguate multi-model layer lookup"
    ),
):
    """
    Get metadata for a specific layer.
    Resolves legacy aliases (e.g. flood_11_factor_v1_full_suitability) transparently.
    """
    safe_layer_id = _sanitize_layer_id(layer_id)
    layer = repository.get_layer(safe_layer_id, model_id=model_id)
    if not layer:
        raise HTTPException(
            status_code=404, detail=f"Layer '{safe_layer_id}' not found in canonical package"
        )

    return LayerInfo(**layer)


@router.get("/tiles/{layer_id:path}/{z}/{x}/{y}.png")
def get_tile(
    layer_id: str,
    z: int,
    x: int,
    y: int,
    model_id: str | None = Query(
        None, description="Optional model ID to disambiguate multi-model layer lookup"
    ),
):
    """
    Render and return a map tile for the specified layer in EPSG:3857.
    Supports all canonical layers: factors, ratings, results, and quality masks.
    Enforces strict coordinate bounds and input validation to prevent resource exhaustion.
    """
    safe_layer_id = _sanitize_layer_id(layer_id)

    # Validate slippy tile coordinates
    if z < 0 or z > 22:
        raise HTTPException(
            status_code=400,
            detail=f"Tile zoom level 'z' must be an integer between 0 and 22 (received {z}).",
        )
    max_coord = 1 << z
    if x < 0 or x >= max_coord or y < 0 or y >= max_coord:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tile coordinates x={x}, y={y} are out of range for zoom level {z}. "
                f"Coordinates must satisfy 0 <= x,y < {max_coord}."
            ),
        )

    tile_data = render_tile(safe_layer_id, z, x, y, model_id=model_id)
    if tile_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Tile {z}/{x}/{y} not available for layer '{safe_layer_id}'",
        )

    return Response(
        content=tile_data,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
        },
    )
