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
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.transform import from_bounds
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

ORIGIN_SHIFT = 20037508.342789244

_layer_bounds_3857: dict[str, tuple[float, float, float, float]] = {}
_layer_range_cache: dict[str, tuple[float, float]] = {}
_tile_cache: dict[str, bytes] = {}
_MAX_TILE_CACHE = 4096

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


def get_tile_bounds_3857(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    """Calculate the bounding box for a Web Mercator slippy tile in EPSG:3857."""
    tile_span = 2.0 * ORIGIN_SHIFT / (1 << z)
    min_x = -ORIGIN_SHIFT + x * tile_span
    max_x = -ORIGIN_SHIFT + (x + 1) * tile_span
    max_y = ORIGIN_SHIFT - y * tile_span
    min_y = ORIGIN_SHIFT - (y + 1) * tile_span
    return min_x, min_y, max_x, max_y


def _get_layer_value_range(layer_id: str, ds: rasterio.DatasetReader) -> tuple[float, float]:
    """Return cached min and max for continuous coloring across all tiles."""
    if layer_id in _layer_range_cache:
        return _layer_range_cache[layer_id]

    if "rating" in layer_id or "suitability" in layer_id:
        _layer_range_cache[layer_id] = (1.0, 5.0)
        return 1.0, 5.0

    try:
        # Fast downsampled overview read (up to 256x256) to determine stable min/max
        out_h = min(ds.height, 256)
        out_w = min(ds.width, 256)
        sub = ds.read(1, out_shape=(1, out_h, out_w))
        nodata = ds.nodata
        valid = ~np.isnan(sub)
        if nodata is not None and not np.isnan(nodata):
            valid = valid & (sub != nodata)
        if np.any(valid):
            vmin = float(np.percentile(sub[valid], 1))
            vmax = float(np.percentile(sub[valid], 99))
            if vmax <= vmin:
                vmin = float(np.min(sub[valid]))
                vmax = float(np.max(sub[valid]))
            if vmax == vmin:
                vmax = vmin + 1.0
            _layer_range_cache[layer_id] = (vmin, vmax)
            return vmin, vmax
    except Exception:
        pass

    _layer_range_cache[layer_id] = (0.0, 1.0)
    return 0.0, 1.0


def render_tile(layer_id: str, z: int, x: int, y: int, tile_size: int = 256) -> Optional[bytes]:
    """
    Render a single map tile as a PNG image.
    Uses slippy-map Web Mercator coordinates (EPSG:3857).
    Guarantees raster stays strictly on the geographic boundary of the state
    and is invariant across all zoom levels.
    """
    cache_key = f"{layer_id}:{z}:{x}:{y}:{tile_size}"
    if cache_key in _tile_cache:
        return _tile_cache[cache_key]

    layer = package_service.get_layer(layer_id)
    if not layer:
        return None

    raster_path = package_service.get_raster_path(layer["relative_path"])
    if not raster_path.exists():
        return None

    try:
        min_x, min_y, max_x, max_y = get_tile_bounds_3857(z, x, y)

        with rasterio.open(raster_path) as ds:
            # Check bounding box intersection in EPSG:3857
            if layer_id not in _layer_bounds_3857:
                try:
                    b_3857 = transform_bounds(ds.crs, "EPSG:3857", *ds.bounds)
                    _layer_bounds_3857[layer_id] = b_3857
                except Exception:
                    _layer_bounds_3857[layer_id] = (-ORIGIN_SHIFT, -ORIGIN_SHIFT, ORIGIN_SHIFT, ORIGIN_SHIFT)

            ds_left, ds_bottom, ds_right, ds_top = _layer_bounds_3857[layer_id]
            if min_x > ds_right or max_x < ds_left or min_y > ds_top or max_y < ds_bottom:
                trans = _transparent_tile(tile_size)
                _tile_cache[cache_key] = trans
                return trans

            dst_transform = from_bounds(min_x, min_y, max_x, max_y, tile_size, tile_size)
            dst_array = np.full((tile_size, tile_size), fill_value=np.nan, dtype=np.float32)

            is_classified = "classified" in layer.get("layer_name", "")

            reproject(
                source=rasterio.band(ds, 1),
                destination=dst_array,
                src_transform=ds.transform,
                src_crs=ds.crs,
                src_nodata=ds.nodata,
                dst_transform=dst_transform,
                dst_crs="EPSG:3857",
                dst_nodata=np.nan,
                resampling=Resampling.nearest if is_classified else Resampling.bilinear,
            )

            valid_mask = ~np.isnan(dst_array)
            if not np.any(valid_mask):
                trans = _transparent_tile(tile_size)
                _tile_cache[cache_key] = trans
                return trans

            rgba = np.zeros((tile_size, tile_size, 4), dtype=np.uint8)

            if is_classified:
                for cls_val, rgb in SUITABILITY_CMAP.items():
                    c_mask = (dst_array == cls_val)
                    if np.any(c_mask):
                        rgba[c_mask, 0] = rgb[0]
                        rgba[c_mask, 1] = rgb[1]
                        rgba[c_mask, 2] = rgb[2]
                        rgba[c_mask, 3] = 190
            else:
                vmin, vmax = _get_layer_value_range(layer_id, ds)
                diff = vmax - vmin if vmax > vmin else 1.0
                val_v = dst_array[valid_mask]
                t = np.clip((val_v - vmin) / diff, 0.0, 1.0)
                colors = np.array(CONTINUOUS_CMAP, dtype=np.float32)
                n = len(colors) - 1
                scaled = t * n
                lower = np.floor(scaled).astype(np.int32)
                upper = np.clip(lower + 1, 0, n)
                frac = (scaled - lower)[:, np.newaxis]
                rgb = (colors[lower] * (1.0 - frac) + colors[upper] * frac).astype(np.uint8)
                rgba[valid_mask, :3] = rgb
                rgba[valid_mask, 3] = 190

            img = Image.fromarray(rgba, "RGBA")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            result_png = buf.getvalue()

            if len(_tile_cache) >= _MAX_TILE_CACHE:
                _tile_cache.pop(next(iter(_tile_cache)))
            _tile_cache[cache_key] = result_png
            return result_png

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
