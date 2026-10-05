"""Layer catalog and tile serving endpoints."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.services.repository import repository
from app.services.raster_service import render_tile
from app.schemas import LayerInfo

router = APIRouter(prefix="/api/v1", tags=["layers"])


@router.get("/layers", response_model=list[LayerInfo])
def list_layers(
    model_id: Optional[str] = Query(
        None,
        description="Filter layers by model ID (e.g. 'flood_11_factor_v1', 'landslide_14_factor_v1', or 'all'). Defaults to primary model.",
    )
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
            raise HTTPException(status_code=404, detail=f"No layers found for model '{model_id}'")
    else:
        # Default: Return primary model layers (flood_11_factor_v1 for backward compatibility)
        flood_layers = repository.get_layers_for_model("flood_11_factor_v1")
        if flood_layers:
            selected_layers = flood_layers
        else:
            selected_layers = repository.layers

    return [LayerInfo(**l) for l in selected_layers]


@router.get("/layers/{layer_id:path}", response_model=LayerInfo)
def get_layer(layer_id: str):
    """
    Get metadata for a specific layer.
    Resolves legacy aliases (e.g. flood_11_factor_v1_full_suitability) transparently.
    """
    layer = repository.get_layer(layer_id)
    if not layer:
        raise HTTPException(
            status_code=404,
            detail=f"Layer '{layer_id}' not found in canonical package"
        )

    return LayerInfo(**layer)


@router.get("/tiles/{layer_id:path}/{z}/{x}/{y}.png")
def get_tile(layer_id: str, z: int, x: int, y: int):
    """
    Render and return a map tile for the specified layer in EPSG:3857.
    Supports all canonical layers: factors, ratings, results, and quality masks.
    """
    tile_data = render_tile(layer_id, z, x, y)
    if tile_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Tile {z}/{x}/{y} not available for layer '{layer_id}'"
        )

    return Response(
        content=tile_data,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    )
