"""
Raster service — point sampling, tile rendering, statistics.

All raster access uses windowed reads (never loads full statewide arrays).
"""
from __future__ import annotations

import io
import logging
import math
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import rasterio
from rasterio.windows import Window
from pyproj import Transformer
from PIL import Image

from app.services.package_service import package_service
from app.services.weights import MODELS_REGISTRY

logger = logging.getLogger(__name__)

# ── CRS transformers (cached) ──────────────────────────────

_transformers: dict[str, Transformer] = {}


def _get_transformer(src_crs: str, dst_crs: str) -> Transformer:
    key = f"{src_crs}->{dst_crs}"
    if key not in _transformers:
        _transformers[key] = Transformer.from_crs(src_crs, dst_crs, always_xy=True)
    return _transformers[key]


# ── Point sampling ──────────────────────────────────────────

def sample_raster(raster_path: Path, lat: float, lon: float) -> Tuple[Optional[float], str]:
    """
    Sample a single pixel value at (lat, lon).
    Returns (value, crs) or (None, crs) if NoData.
    """
    try:
        with rasterio.open(raster_path) as ds:
            crs_str = str(ds.crs)
            # Transform lat/lon (EPSG:4326) to the raster's CRS
            if ds.crs and str(ds.crs) != "EPSG:4326":
                transformer = _get_transformer("EPSG:4326", str(ds.crs))
                x, y = transformer.transform(lon, lat)
            else:
                x, y = lon, lat

            # Convert to pixel coordinates
            row, col = ds.index(x, y)

            # Bounds check
            if row < 0 or row >= ds.height or col < 0 or col >= ds.width:
                return None, crs_str

            # Windowed read — single pixel
            window = Window(col, row, 1, 1)
            data = ds.read(1, window=window)
            value = float(data[0, 0])

            # NoData check
            nodata = ds.nodata
            if nodata is not None and (np.isnan(value) or value == nodata):
                return None, crs_str
            if np.isnan(value):
                return None, crs_str

            return value, crs_str
    except Exception as e:
        logger.warning("Failed to sample %s at (%s, %s): %s", raster_path, lat, lon, e)
        return None, ""


def point_inspection(model_id: str, lat: float, lon: float) -> dict:
    """
    Sample all factor rasters, rating rasters, and result rasters
    for the given model at the specified coordinates.
    """
    model_config = MODELS_REGISTRY.get(model_id)
    if not model_config:
        return {"error": f"Model {model_id} not found"}

    results = []
    factor_layers = {l["criterion_id"]: l for l in package_service.factor_layers()}
    rating_layers = {l["criterion_id"]: l for l in package_service.rating_layers()}

    for criterion in model_config.criteria:
        weight = model_config.weight_for(criterion)
        entry = {
            "criterion": criterion,
            "raw_value": None,
            "unit": "",
            "rating": None,
            "weight": weight,
            "contribution": None,
            "status": "NODATA",
            "nodata_reason": None,
            "source": "",
        }

        # Sample factor raster (raw value)
        factor = factor_layers.get(criterion)
        if factor:
            path = package_service.get_raster_path(factor["relative_path"])
            entry["source"] = factor.get("description", "")
            raw_val, _ = sample_raster(path, lat, lon)
            if raw_val is not None:
                entry["raw_value"] = round(raw_val, 6)
                entry["status"] = "VALID"
            else:
                entry["nodata_reason"] = "Factor raster contains NoData at this location"

        # Sample rating raster
        rating = rating_layers.get(criterion)
        if rating:
            path = package_service.get_raster_path(rating["relative_path"])
            rating_val, _ = sample_raster(path, lat, lon)
            if rating_val is not None:
                entry["rating"] = round(rating_val, 6)
                entry["contribution"] = round(rating_val * weight, 6)
                if entry["status"] != "VALID":
                    entry["status"] = "VALID"
            elif entry["status"] == "VALID":
                # Factor exists but rating is NoData
                entry["rating"] = None
                entry["contribution"] = None

        results.append(entry)

    # Sample result rasters
    continuous_score = None
    classified_value = None
    class_label = None
    final_status = "VALID"

    result_layers = package_service.result_layers()
    for rl in result_layers:
        path = package_service.get_raster_path(rl["relative_path"])
        val, _ = sample_raster(path, lat, lon)
        if "classified" in rl["layer_name"]:
            if val is not None:
                classified_value = round(val, 0)
                class_label = model_config.classification_labels.get(
                    int(classified_value), "Unknown"
                )
            else:
                final_status = "NODATA"
        else:
            if val is not None:
                continuous_score = round(val, 6)
            else:
                final_status = "NODATA"

    return {
        "lat": lat,
        "lon": lon,
        "model_id": model_id,
        "continuous_score": continuous_score,
        "classified_value": classified_value,
        "class_label": class_label,
        "final_status": final_status,
        "criteria": results,
    }


# ── Tile rendering ─────────────────────────────────────────

# Color maps for different layer types
SUITABILITY_CMAP = {
    1: (239, 68, 68),     # Very Low  — red
    2: (249, 115, 22),    # Low       — orange
    3: (251, 191, 36),    # Moderate  — yellow
    4: (74, 222, 128),    # High      — green
    5: (0, 200, 150),     # Very High — teal
}

CONTINUOUS_CMAP = [
    (239, 68, 68),
    (249, 115, 22),
    (251, 191, 36),
    (74, 222, 128),
    (0, 200, 150),
]


def _value_to_continuous_color(value: float, vmin: float, vmax: float) -> Tuple[int, int, int, int]:
    """Map a continuous value to an RGBA color using a gradient."""
    if vmax == vmin:
        t = 0.5
    else:
        t = max(0.0, min(1.0, (value - vmin) / (vmax - vmin)))

    n = len(CONTINUOUS_CMAP) - 1
    idx = t * n
    lower = int(idx)
    upper = min(lower + 1, n)
    frac = idx - lower

    r = int(CONTINUOUS_CMAP[lower][0] * (1 - frac) + CONTINUOUS_CMAP[upper][0] * frac)
    g = int(CONTINUOUS_CMAP[lower][1] * (1 - frac) + CONTINUOUS_CMAP[upper][1] * frac)
    b = int(CONTINUOUS_CMAP[lower][2] * (1 - frac) + CONTINUOUS_CMAP[upper][2] * frac)
    return r, g, b, 200


def render_tile(layer_id: str, z: int, x: int, y: int, tile_size: int = 256) -> Optional[bytes]:
    """
    Render a single map tile as a PNG image.
    Uses slippy-map tile coordinates (z/x/y).
    """
    layer = package_service.get_layer(layer_id)
    if not layer:
        return None

    raster_path = package_service.get_raster_path(layer["relative_path"])
    if not raster_path.exists():
        return None

    try:
        with rasterio.open(raster_path) as ds:
            # Compute tile bounds in EPSG:4326 (Web Mercator tile scheme)
            n = 2 ** z
            lon_min = x / n * 360.0 - 180.0
            lon_max = (x + 1) / n * 360.0 - 180.0
            lat_max = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
            lat_min = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))

            # Transform tile bounds to raster CRS
            crs_str = str(ds.crs)
            if crs_str != "EPSG:4326":
                transformer = _get_transformer("EPSG:4326", crs_str)
                x_min, y_min = transformer.transform(lon_min, lat_min)
                x_max, y_max = transformer.transform(lon_max, lat_max)
            else:
                x_min, y_min = lon_min, lat_min
                x_max, y_max = lon_max, lat_max

            # Compute the raster window
            col_min, row_max = ~ds.transform * (x_min, y_min)
            col_max, row_min = ~ds.transform * (x_max, y_max)

            # Clip to raster bounds
            col_min = max(0, int(col_min))
            col_max = min(ds.width, int(col_max) + 1)
            row_min = max(0, int(row_min))
            row_max = min(ds.height, int(row_max) + 1)

            if col_min >= col_max or row_min >= row_max:
                # Tile is outside raster extent — return transparent
                return _transparent_tile(tile_size)

            window = Window(col_min, row_min, col_max - col_min, row_max - row_min)
            data = ds.read(1, window=window)
            nodata = ds.nodata

            # Determine if classified or continuous
            is_classified = "classified" in layer.get("layer_name", "")

            # Create RGBA image
            img = Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0))
            pixels = img.load()

            h, w = data.shape
            if h == 0 or w == 0:
                return _transparent_tile(tile_size)

            # Compute value range for continuous coloring
            valid_mask = np.ones_like(data, dtype=bool)
            if nodata is not None:
                if np.isnan(nodata):
                    valid_mask = ~np.isnan(data)
                else:
                    valid_mask = data != nodata
            valid_mask = valid_mask & ~np.isnan(data)

            if not np.any(valid_mask):
                return _transparent_tile(tile_size)

            valid_data = data[valid_mask]
            vmin = float(np.nanmin(valid_data))
            vmax = float(np.nanmax(valid_data))

            for ty in range(tile_size):
                for tx in range(tile_size):
                    # Map tile pixel to data pixel
                    dy = int(ty * h / tile_size)
                    dx = int(tx * w / tile_size)
                    dy = min(dy, h - 1)
                    dx = min(dx, w - 1)

                    val = data[dy, dx]

                    # NoData check
                    if np.isnan(val):
                        continue
                    if nodata is not None and not np.isnan(nodata) and val == nodata:
                        continue

                    if is_classified:
                        color = SUITABILITY_CMAP.get(int(val), (128, 128, 128))
                        pixels[tx, ty] = (*color, 180)
                    else:
                        pixels[tx, ty] = _value_to_continuous_color(val, vmin, vmax)

            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue()

    except Exception as e:
        logger.warning("Failed to render tile %s/%d/%d/%d: %s", layer_id, z, x, y, e)
        return None


def _transparent_tile(size: int = 256) -> bytes:
    """Return a fully transparent PNG tile."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── Statistics ─────────────────────────────────────────────

_stats_cache: dict[str, dict] = {}


def compute_statistics(model_id: str) -> dict:
    """Compute statistics for the result rasters of a model."""
    if model_id in _stats_cache:
        return _stats_cache[model_id]

    model_config = MODELS_REGISTRY.get(model_id)
    if not model_config:
        return {"error": f"Model {model_id} not found"}

    result = {
        "model_id": model_id,
        "total_pixels": 0,
        "valid_pixels": 0,
        "nodata_pixels": 0,
        "valid_coverage_pct": 0.0,
        "nodata_coverage_pct": 0.0,
        "score_min": None,
        "score_max": None,
        "score_mean": None,
        "score_std": None,
        "class_distribution": [],
        "resolution_m": None,
        "crs": "",
    }

    # Continuous suitability
    result_layers = package_service.result_layers()
    for rl in result_layers:
        path = package_service.get_raster_path(rl["relative_path"])
        if not path.exists():
            continue

        is_classified = "classified" in rl["layer_name"]

        try:
            with rasterio.open(path) as ds:
                result["crs"] = str(ds.crs)
                result["resolution_m"] = round(abs(ds.transform[0]) * 111320 if str(ds.crs) == "EPSG:4326" else abs(ds.transform[0]), 2)

                # Read full raster (for statistics we need all values)
                data = ds.read(1)
                nodata = ds.nodata

                # Create valid mask
                valid_mask = ~np.isnan(data)
                if nodata is not None and not np.isnan(nodata):
                    valid_mask = valid_mask & (data != nodata)

                total = data.size
                valid = int(np.sum(valid_mask))
                nodata_count = total - valid

                if is_classified:
                    # Class distribution
                    valid_data = data[valid_mask]
                    unique, counts = np.unique(valid_data.astype(int), return_counts=True)

                    pixel_area_km2 = None
                    if result["resolution_m"]:
                        pixel_area_km2 = (result["resolution_m"] ** 2) / 1e6

                    class_dist = []
                    for cls_val, cnt in zip(unique, counts):
                        cnt = int(cnt)
                        pct = round(cnt / valid * 100, 2) if valid > 0 else 0.0
                        area = round(cnt * pixel_area_km2, 2) if pixel_area_km2 else None
                        label = model_config.classification_labels.get(int(cls_val), f"Class {cls_val}")
                        class_dist.append({
                            "class_value": int(cls_val),
                            "label": label,
                            "pixel_count": cnt,
                            "percentage": pct,
                            "area_km2": area,
                        })
                    result["class_distribution"] = class_dist
                else:
                    # Continuous statistics
                    result["total_pixels"] = total
                    result["valid_pixels"] = valid
                    result["nodata_pixels"] = nodata_count
                    result["valid_coverage_pct"] = round(valid / total * 100, 2) if total > 0 else 0.0
                    result["nodata_coverage_pct"] = round(nodata_count / total * 100, 2) if total > 0 else 0.0

                    if valid > 0:
                        valid_data = data[valid_mask]
                        result["score_min"] = round(float(np.nanmin(valid_data)), 6)
                        result["score_max"] = round(float(np.nanmax(valid_data)), 6)
                        result["score_mean"] = round(float(np.nanmean(valid_data)), 6)
                        result["score_std"] = round(float(np.nanstd(valid_data)), 6)

        except Exception as e:
            logger.warning("Failed to compute stats for %s: %s", rl["layer_name"], e)

    _stats_cache[model_id] = result
    return result
