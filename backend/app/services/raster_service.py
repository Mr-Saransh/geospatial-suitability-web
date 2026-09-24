"""
Raster service — point sampling, tile rendering, and statistics.

All raster access uses windowed reads (never loads full statewide arrays into memory).
Adheres strictly to the canonical Himachal Pradesh Spatial Knowledge Package.
"""
from __future__ import annotations

import io
import logging
import math
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional, Tuple

import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.transform import from_bounds
from pyproj import Transformer
from PIL import Image

from app.services.package_service import package_service, PRODUCT_METADATA
from app.services.weights import MODELS_REGISTRY

logger = logging.getLogger(__name__)

# Bitmask mapping from package manifest
BIT_CRITERIA_MAP: dict[int, str] = {
    1: "slope",
    2: "distance_to_rivers",
    4: "twi",
    8: "rainfall",
    16: "flow_accumulation",
    32: "drainage_density",
    64: "lulc",
    128: "elevation",
    256: "soil",
    512: "curvature",
    1024: "ndvi",
}

CRITERIA_DISPLAY_NAMES: dict[str, str] = {
    "rainfall": "Annual Rainfall",
    "distance_to_rivers": "Distance to Rivers",
    "drainage_density": "Drainage Density",
    "flow_accumulation": "Flow Accumulation",
    "twi": "Topographic Wetness Index (TWI)",
    "elevation": "Elevation",
    "slope": "Terrain Slope",
    "curvature": "Curvature",
    "lulc": "Land Use / Land Cover (LULC)",
    "soil": "Soil Texture & Permeability",
    "ndvi": "NDVI Vegetation Density",
}

CRITERIA_UNITS: dict[str, str] = {
    "rainfall": "mm/yr",
    "distance_to_rivers": "m",
    "drainage_density": "km/km²",
    "flow_accumulation": "cells",
    "twi": "index",
    "elevation": "m asl",
    "slope": "°",
    "curvature": "1/m",
    "lulc": "class",
    "soil": "class",
    "ndvi": "index",
}

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
    Sample a single pixel value at (lat, lon) using a 1x1 windowed read.
    Returns (value, crs) or (None, crs) if NoData or out of bounds.
    """
    if not raster_path.exists():
        return None, ""

    try:
        with rasterio.open(raster_path) as ds:
            crs_str = str(ds.crs)
            if ds.crs and str(ds.crs) != "EPSG:4326":
                transformer = _get_transformer("EPSG:4326", str(ds.crs))
                x, y = transformer.transform(lon, lat)
            else:
                x, y = lon, lat

            # Bounds check in dataset coordinate space
            left, bottom, right, top = ds.bounds
            if x < left or x > right or y < bottom or y > top:
                return None, crs_str

            row, col = ds.index(x, y)
            if row < 0 or row >= ds.height or col < 0 or col >= ds.width:
                return None, crs_str

            # Windowed read of a single pixel
            window = Window(col, row, 1, 1)
            data = ds.read(1, window=window)
            value = float(data[0, 0])

            # NoData / NaN check
            nodata = ds.nodata
            if nodata is not None and (value == nodata or (math.isnan(nodata) and math.isnan(value))):
                return None, crs_str
            if math.isnan(value):
                return None, crs_str

            return value, crs_str
    except Exception as e:
        logger.debug("Failed to sample %s at (%s, %s): %s", raster_path.name, lat, lon, e)
        return None, ""


def point_inspection(model_id: str, lat: float, lon: float) -> dict:
    """
    Perform point inspection across all 28 canonical package rasters.
    Accurately detects VALID, PARTIAL_EVIDENCE, NODATA, and OUTSIDE_ANALYSIS_AREA.
    Decodes missing_criteria_bitmask into specific missing criteria names.
    Preserves strict null semantics for missing criteria (never substitutes 0, 1, or 5).
    """
    model_config = MODELS_REGISTRY.get(model_id)
    if not model_config:
        return {"error": f"Model {model_id} not found"}

    # Spatial bounds check: Himachal Pradesh bounding box
    # [75.57855, 30.38430, 78.99682, 33.25577]
    min_lon, min_lat, max_lon, max_lat = 75.57855, 30.38430, 78.99682, 33.25577
    if lat < min_lat or lat > max_lat or lon < min_lon or lon > max_lon:
        return _outside_analysis_response(model_id, lat, lon, model_config)

    # Sample Quality Rasters first
    valid_count_layer = package_service.get_layer("flood_11_factor_v1_valid_criteria_count")
    bitmask_layer = package_service.get_layer("flood_11_factor_v1_missing_criteria_bitmask")

    valid_count_val = None
    bitmask_val = None

    if valid_count_layer:
        p = package_service.get_raster_path(valid_count_layer["relative_path"])
        val, _ = sample_raster(p, lat, lon)
        valid_count_val = val

    if bitmask_layer:
        p = package_service.get_raster_path(bitmask_layer["relative_path"])
        val, _ = sample_raster(p, lat, lon)
        bitmask_val = val

    # If bitmask is 0, or valid_criteria_count is 255 (NoData), or both are None:
    # the coordinate is outside the masked Himachal Pradesh study area.
    if (bitmask_val is None and valid_count_val is None) or \
       (bitmask_val == 0) or \
       (valid_count_val == 255) or \
       (valid_count_val is None and bitmask_val == 0):
        return _outside_analysis_response(model_id, lat, lon, model_config)

    # Decode bitmask into missing criteria
    int_bitmask = int(bitmask_val) if bitmask_val is not None else 2047
    missing_criteria: list[str] = []
    for bit, crit in BIT_CRITERIA_MAP.items():
        if (int_bitmask & bit) == 0:
            missing_criteria.append(crit)

    evidence_count = 11 - len(missing_criteria)
    if valid_count_val is not None and valid_count_val < 255:
        evidence_count = int(valid_count_val)

    # Determine final_status and scoring_mode
    if len(missing_criteria) == 0 and evidence_count == 11:
        final_status = "VALID"
        scoring_mode = "STRICT_11_OF_11"
    elif evidence_count >= model_config.minimum_valid_criteria:
        final_status = "PARTIAL_EVIDENCE"
        scoring_mode = "AVAILABLE_EVIDENCE_RENORMALIZED"
    else:
        final_status = "NODATA"
        scoring_mode = f"INSUFFICIENT_CRITERIA (<{model_config.minimum_valid_criteria})"

    # Sample user-facing result rasters
    avail_cont_layer = package_service.get_layer("flood_11_factor_v1_available_evidence_suitability")
    avail_cls_layer = package_service.get_layer("flood_11_factor_v1_available_evidence_suitability_classified")
    strict_cont_layer = package_service.get_layer("flood_11_factor_v1_strict_suitability")
    strict_cls_layer = package_service.get_layer("flood_11_factor_v1_strict_suitability_classified")

    avail_score = None
    if avail_cont_layer:
        v, _ = sample_raster(package_service.get_raster_path(avail_cont_layer["relative_path"]), lat, lon)
        avail_score = round(v, 6) if v is not None else None

    avail_cls = None
    if avail_cls_layer:
        v, _ = sample_raster(package_service.get_raster_path(avail_cls_layer["relative_path"]), lat, lon)
        avail_cls = round(v, 0) if (v is not None and v > 0) else None

    strict_score = None
    if strict_cont_layer and final_status == "VALID":
        v, _ = sample_raster(package_service.get_raster_path(strict_cont_layer["relative_path"]), lat, lon)
        strict_score = round(v, 6) if v is not None else avail_score

    strict_cls = None
    if strict_cls_layer and final_status == "VALID":
        v, _ = sample_raster(package_service.get_raster_path(strict_cls_layer["relative_path"]), lat, lon)
        strict_cls = round(v, 0) if (v is not None and v > 0) else avail_cls

    continuous_score = avail_score
    classified_value = avail_cls

    class_label = None
    if classified_value is not None:
        class_label = model_config.classification_labels.get(int(classified_value), "Unknown")

    # Sample all 11 criteria (factor + rating)
    criteria_results = []
    factor_layers = {l["criterion_id"]: l for l in package_service.factor_layers() if l.get("criterion_id")}
    rating_layers = {l["criterion_id"]: l for l in package_service.rating_layers() if l.get("criterion_id")}

    for crit in model_config.criteria:
        weight = model_config.weight_for(crit)
        disp_name = CRITERIA_DISPLAY_NAMES.get(crit, crit.replace("_", " ").title())
        unit = CRITERIA_UNITS.get(crit, "")

        is_missing = crit in missing_criteria

        if is_missing or final_status == "NODATA":
            criteria_results.append({
                "criterion": crit,
                "display_name": disp_name,
                "raw_value": None,
                "unit": unit,
                "rating": None,
                "weight": weight,
                "contribution": None,
                "status": "NODATA",
                "nodata_reason": f"Criterion '{disp_name}' not available at this location",
                "source": "Canonical Package",
            })
            continue

        raw_val = None
        fl = factor_layers.get(crit)
        if fl:
            p = package_service.get_raster_path(fl["relative_path"])
            v, _ = sample_raster(p, lat, lon)
            raw_val = round(v, 6) if v is not None else None

        rating_val = None
        rl = rating_layers.get(crit)
        if rl:
            p = package_service.get_raster_path(rl["relative_path"])
            v, _ = sample_raster(p, lat, lon)
            rating_val = round(v, 6) if v is not None else None

        contribution = None
        if rating_val is not None:
            contribution = round(rating_val * weight, 6)

        status = "VALID" if rating_val is not None else "NODATA"
        reason = None if status == "VALID" else f"No valid rating for {disp_name}"

        criteria_results.append({
            "criterion": crit,
            "display_name": disp_name,
            "raw_value": raw_val,
            "unit": unit,
            "rating": rating_val,
            "weight": weight,
            "contribution": contribution,
            "status": status,
            "nodata_reason": reason,
            "source": fl.get("description", "Canonical Package") if fl else "Canonical Package",
        })

    return {
        "lat": lat,
        "lon": lon,
        "model_id": model_id,
        "continuous_score": continuous_score,
        "classified_value": classified_value,
        "class_label": class_label,
        "final_status": final_status,
        "evidence_count": evidence_count,
        "evidence_total": 11,
        "missing_criteria": missing_criteria,
        "scoring_mode": scoring_mode,
        "strict_score": strict_score,
        "available_evidence_score": avail_score,
        "criteria": criteria_results,
    }


def _outside_analysis_response(model_id: str, lat: float, lon: float, model_config: Any) -> dict:
    """Standardized response when query coordinate lies outside Himachal Pradesh."""
    criteria_results = [
        {
            "criterion": crit,
            "display_name": CRITERIA_DISPLAY_NAMES.get(crit, crit.replace("_", " ").title()),
            "raw_value": None,
            "unit": CRITERIA_UNITS.get(crit, ""),
            "rating": None,
            "weight": model_config.weight_for(crit),
            "contribution": None,
            "status": "OUTSIDE_ANALYSIS_AREA",
            "nodata_reason": "Coordinate is outside the Himachal Pradesh analysis boundary",
            "source": "",
        }
        for crit in model_config.criteria
    ]
    return {
        "lat": lat,
        "lon": lon,
        "model_id": model_id,
        "continuous_score": None,
        "classified_value": None,
        "class_label": None,
        "final_status": "OUTSIDE_ANALYSIS_AREA",
        "evidence_count": 0,
        "evidence_total": 11,
        "missing_criteria": [],
        "scoring_mode": None,
        "strict_score": None,
        "available_evidence_score": None,
        "criteria": criteria_results,
    }


# ── Tile rendering ─────────────────────────────────────────

ORIGIN_SHIFT = 20037508.342789244

_layer_bounds_3857: dict[str, tuple[float, float, float, float]] = {}
_layer_range_cache: dict[str, tuple[float, float]] = {}
_tile_cache: dict[str, bytes] = {}
_MAX_TILE_CACHE = 4096

# Susceptibility classified discrete hazard colors: Green (1) to Red (5)
SUITABILITY_CMAP = {
    1: (0, 200, 150),     # Class 1: Very Low Susceptibility  — Green
    2: (74, 222, 128),    # Class 2: Low Susceptibility       — Light Green
    3: (251, 191, 36),    # Class 3: Moderate Susceptibility  — Yellow
    4: (249, 115, 22),    # Class 4: High Susceptibility      — Orange
    5: (239, 68, 68),     # Class 5: Very High Susceptibility — Red
}

# Quality valid_criteria_count discrete colors
VALID_CRITERIA_CMAP = {
    11: (74, 222, 128),   # 11/11 — Full evidence (Green)
    10: (0, 180, 216),    # 10/11 — Partial evidence (Cyan / Blue)
    9:  (251, 191, 36),   # 9/11  — Partial evidence (Yellow)
    8:  (249, 115, 22),   # 8/11  — Minimum required (Orange)
    7:  (239, 68, 68),    # <8    — Sub-threshold NoData (Red)
    6:  (239, 68, 68),
    5:  (239, 68, 68),
}

# Continuous multi-color hazard gradient: Green (1.0) to Red (5.0)
CONTINUOUS_CMAP = [
    (0, 200, 150),     # 1.0: Green (Very Low)
    (74, 222, 128),    # 2.0: Light Green (Low)
    (251, 191, 36),    # 3.0: Yellow (Moderate)
    (249, 115, 22),    # 4.0: Orange (High)
    (239, 68, 68),     # 5.0: Red (Very High)
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
    Render a single map tile as a PNG image in EPSG:3857 Web Mercator.
    Guarantees raster stays strictly on the geographic boundary of the state.
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
            canon_id = layer["product_id"]
            if canon_id not in _layer_bounds_3857:
                try:
                    b_3857 = transform_bounds(ds.crs, "EPSG:3857", *ds.bounds)
                    _layer_bounds_3857[canon_id] = b_3857
                except Exception:
                    _layer_bounds_3857[canon_id] = (-ORIGIN_SHIFT, -ORIGIN_SHIFT, ORIGIN_SHIFT, ORIGIN_SHIFT)

            ds_left, ds_bottom, ds_right, ds_top = _layer_bounds_3857[canon_id]
            if min_x > ds_right or max_x < ds_left or min_y > ds_top or max_y < ds_bottom:
                trans = _transparent_tile(tile_size)
                _tile_cache[cache_key] = trans
                return trans

            dst_transform = from_bounds(min_x, min_y, max_x, max_y, tile_size, tile_size)
            dst_array = np.full((tile_size, tile_size), fill_value=np.nan, dtype=np.float32)

            is_classified = "classified" in canon_id
            is_valid_criteria = "valid_criteria_count" in canon_id
            is_bitmask = "missing_criteria_bitmask" in canon_id
            is_discrete = is_classified or is_valid_criteria or is_bitmask

            reproject(
                source=rasterio.band(ds, 1),
                destination=dst_array,
                src_transform=ds.transform,
                src_crs=ds.crs,
                src_nodata=ds.nodata,
                dst_transform=dst_transform,
                dst_crs="EPSG:3857",
                dst_nodata=np.nan,
                resampling=Resampling.nearest if is_discrete else Resampling.bilinear,
            )

            valid_mask = ~np.isnan(dst_array)
            if ds.nodata is not None and not np.isnan(ds.nodata):
                valid_mask = valid_mask & (dst_array != ds.nodata)
            # Filter out 0 for classified and bitmask
            if is_classified or is_bitmask:
                valid_mask = valid_mask & (dst_array > 0)
            if is_valid_criteria:
                valid_mask = valid_mask & (dst_array < 255) & (dst_array > 0)

            if not np.any(valid_mask):
                trans = _transparent_tile(tile_size)
                _tile_cache[cache_key] = trans
                return trans

            rgba = np.zeros((tile_size, tile_size, 4), dtype=np.uint8)

            if is_classified:
                for cls_val, rgb in SUITABILITY_CMAP.items():
                    c_mask = valid_mask & (np.round(dst_array) == cls_val)
                    if np.any(c_mask):
                        rgba[c_mask, 0] = rgb[0]
                        rgba[c_mask, 1] = rgb[1]
                        rgba[c_mask, 2] = rgb[2]
                        rgba[c_mask, 3] = 195
            elif is_valid_criteria:
                for cnt_val, rgb in VALID_CRITERIA_CMAP.items():
                    c_mask = valid_mask & (np.round(dst_array) == cnt_val)
                    if np.any(c_mask):
                        rgba[c_mask, 0] = rgb[0]
                        rgba[c_mask, 1] = rgb[1]
                        rgba[c_mask, 2] = rgb[2]
                        rgba[c_mask, 3] = 200
            elif is_bitmask:
                # Color code bitmask: 2047 all valid = emerald, others = orange/amber
                all_valid_mask = valid_mask & (dst_array == 2047)
                partial_mask = valid_mask & (dst_array != 2047)
                rgba[all_valid_mask, 0] = 74
                rgba[all_valid_mask, 1] = 222
                rgba[all_valid_mask, 2] = 128
                rgba[all_valid_mask, 3] = 195
                rgba[partial_mask, 0] = 249
                rgba[partial_mask, 1] = 115
                rgba[partial_mask, 2] = 22
                rgba[partial_mask, 3] = 195
            else:
                vmin, vmax = _get_layer_value_range(canon_id, ds)
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
    """
    Return statistics for the canonical Flood model.
    The default statistics correspond strictly to:
    flood_11_factor_v1_available_evidence_suitability_classified.
    Also exposes evidence distribution across valid criteria counts (11/11, 10/11, 9/11, 8/11).
    """
    if model_id in _stats_cache:
        return _stats_cache[model_id]

    model_config = MODELS_REGISTRY.get(model_id)
    if not model_config:
        return {"error": f"Model {model_id} not found"}

    # Canonical published values for Run #56
    # Total pixels: 135,148,020 (12684 x 10655 grid)
    # Valid pixels: 73,000,293 (54.015%)
    # NoData pixels: 62,147,727 (45.985%)
    # Area per pixel: (0.00026949 deg * 111320 m/deg)^2 = ~900 m2 = 0.0009 km2
    class_dist = [
        {
            "class_value": 1,
            "label": "Very Low Susceptibility",
            "pixel_count": 46676143,
            "percentage": 63.94,
            "area_km2": 42008.53,
        },
        {
            "class_value": 2,
            "label": "Low Susceptibility",
            "pixel_count": 24513495,
            "percentage": 33.58,
            "area_km2": 22062.15,
        },
        {
            "class_value": 3,
            "label": "Moderate Susceptibility",
            "pixel_count": 1450815,
            "percentage": 1.99,
            "area_km2": 1305.73,
        },
        {
            "class_value": 4,
            "label": "High Susceptibility",
            "pixel_count": 317406,
            "percentage": 0.43,
            "area_km2": 285.67,
        },
        {
            "class_value": 5,
            "label": "Very High Susceptibility",
            "pixel_count": 42434,
            "percentage": 0.06,
            "area_km2": 38.19,
        },
    ]

    evidence_dist = [
        {
            "criteria_count": 11,
            "label": "11 / 11 Criteria (Full)",
            "pixel_count": 49291505,
            "percentage": 67.52,
        },
        {
            "criteria_count": 10,
            "label": "10 / 11 Criteria",
            "pixel_count": 23690551,
            "percentage": 32.45,
        },
        {
            "criteria_count": 9,
            "label": "9 / 11 Criteria",
            "pixel_count": 14347,
            "percentage": 0.02,
        },
        {
            "criteria_count": 8,
            "label": "8 / 11 Criteria (Min Threshold)",
            "pixel_count": 3890,
            "percentage": 0.01,
        },
    ]

    result = {
        "model_id": model_id,
        "source_run_id": 56,
        "scoring_mode": "AVAILABLE_EVIDENCE_RENORMALIZED",
        "total_pixels": 135148020,
        "valid_pixels": 73000293,
        "nodata_pixels": 62147727,
        "valid_coverage_pct": 54.02,
        "nodata_coverage_pct": 45.98,
        "score_min": 1.063014,
        "score_max": 4.869657,
        "score_mean": 1.7357,
        "score_std": 0.3521,
        "class_distribution": class_dist,
        "evidence_distribution": evidence_dist,
        "resolution_m": 30.0,
        "crs": "EPSG:4326",
    }

    _stats_cache[model_id] = result
    return result
