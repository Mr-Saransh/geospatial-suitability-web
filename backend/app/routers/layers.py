"""Layer catalog and tile serving endpoints."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.package_service import package_service
from app.services.raster_service import render_tile
from app.schemas import LayerInfo

router = APIRouter(prefix="/api/v1", tags=["layers"])


@router.get("/layers", response_model=list[LayerInfo])
def list_layers():
    """
    List all 28 available raster layers from the canonical spatial package.
    Returns rich semantic metadata, unique display names, and categories.
    """
    return [LayerInfo(**l) for l in package_service.layers]


@router.get("/layers/{layer_id:path}", response_model=LayerInfo)
def get_layer(layer_id: str):
    """
    Get metadata for a specific layer.
    Resolves legacy aliases (e.g. flood_11_factor_v1_full_suitability) transparently.
    """
    layer = package_service.get_layer(layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail=f"Layer '{layer_id}' not found in canonical package")

    return LayerInfo(**layer)


@router.get("/tiles/{layer_id:path}/{z}/{x}/{y}.png")
def get_tile(layer_id: str, z: int, x: int, y: int):
    """
    Render and return a map tile for the specified layer in EPSG:3857.
    Supports all 28 canonical layers: factors, ratings, results, and quality masks.
    """
    tile_data = render_tile(layer_id, z, x, y)
    if tile_data is None:
        raise HTTPException(status_code=404, detail=f"Tile {z}/{x}/{y} not available for layer '{layer_id}'")

    return Response(
        content=tile_data,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    )
