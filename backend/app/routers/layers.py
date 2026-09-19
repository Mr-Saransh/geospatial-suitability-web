"""Layer catalog and tile serving endpoints."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.package_service import package_service
from app.services.raster_service import render_tile
from app.schemas import LayerInfo

router = APIRouter(prefix="/api/v1", tags=["layers"])


@router.get("/layers", response_model=list[LayerInfo])
def list_layers():
    """List all available raster layers from the spatial package."""
    return [
        LayerInfo(
            layer_id=l["layer_name"],
            layer_name=l["layer_name"],
            layer_type=l["layer_type"],
            criterion_id=l.get("criterion_id", ""),
            model_id=l.get("model_id", ""),
            crs=l.get("crs", ""),
            resolution_x=l.get("resolution_x", 0),
            resolution_y=l.get("resolution_y", 0),
            width=l.get("width", 0),
            height=l.get("height", 0),
            nodata_value=str(l.get("nodata_value", "")),
            valid_pixel_pct=l.get("valid_pixel_pct", 0),
            description=l.get("description", ""),
            relative_path=l.get("relative_path", ""),
        )
        for l in package_service.layers
    ]


@router.get("/layers/{layer_id:path}")
def get_layer(layer_id: str):
    """Get information about a specific layer."""
    layer = package_service.get_layer(layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail=f"Layer '{layer_id}' not found")

    return LayerInfo(
        layer_id=layer["layer_name"],
        layer_name=layer["layer_name"],
        layer_type=layer["layer_type"],
        criterion_id=layer.get("criterion_id", ""),
        model_id=layer.get("model_id", ""),
        crs=layer.get("crs", ""),
        resolution_x=layer.get("resolution_x", 0),
        resolution_y=layer.get("resolution_y", 0),
        width=layer.get("width", 0),
        height=layer.get("height", 0),
        nodata_value=str(layer.get("nodata_value", "")),
        valid_pixel_pct=layer.get("valid_pixel_pct", 0),
        description=layer.get("description", ""),
        relative_path=layer.get("relative_path", ""),
    )


@router.get("/tiles/{layer_id:path}/{z}/{x}/{y}.png")
def get_tile(layer_id: str, z: int, x: int, y: int):
    """Render and return a map tile for the specified layer."""
    tile_data = render_tile(layer_id, z, x, y)
    if tile_data is None:
        raise HTTPException(status_code=404, detail="Tile not available")

    return Response(
        content=tile_data,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    )
