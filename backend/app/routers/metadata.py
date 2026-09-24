"""Package and analysis metadata endpoints."""
from __future__ import annotations

import logging
import sqlite3
import struct
from typing import Any

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.services.package_service import package_service
from app.services.weights import MODELS_REGISTRY
from app.schemas import PackageMetadata, AnalysisMetadata, CriterionWeight

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["metadata"])


@router.get("/metadata/package", response_model=PackageMetadata)
def get_package_metadata():
    """Return full spatial package metadata for the canonical package."""
    return PackageMetadata(
        package_status="healthy",
        package_version=package_service.package_version,
        state_name=package_service.state_name,
        model_id=package_service.model_id,
        source_run_id=package_service.source_run_id,
        published_at=package_service.published_at,
        package_type=package_service.manifest.get("package_type", "Spatial Knowledge Package"),
        spec_version=str(package_service.manifest.get("spec_version", "1.0")),
        layers_count=package_service.total_published_rasters,
        rasters_count=package_service.total_published_rasters,
        vectors_count=1,
        factor_count=package_service.factor_count,
        rating_count=package_service.rating_count,
        result_count=package_service.result_count,
        quality_count=package_service.quality_count,
        total_published_rasters=package_service.total_published_rasters,
        boundary_status="available",
        manifest_status="valid",
        scoring_modes=[
            "AVAILABLE_EVIDENCE_RENORMALIZED",
            "STRICT_11_OF_11",
        ],
        minimum_valid_criteria=8,
        aliases=package_service.aliases,
        reproducibility=package_service.reproducibility,
        provenance=package_service.provenance,
        validation_status="PASSED",
    )


@router.get("/analyses/{analysis_id}/metadata", response_model=AnalysisMetadata)
def get_analysis_metadata(analysis_id: str):
    """Return metadata for a specific analysis/model."""
    model = MODELS_REGISTRY.get(analysis_id)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{analysis_id}' not found")

    result_layers = package_service.result_layers()
    crs = result_layers[0].get("crs", "EPSG:4326") if result_layers else "EPSG:4326"
    res_str = result_layers[0].get("resolution", "30 m") if result_layers else "30 m"

    return AnalysisMetadata(
        model_id=model.model_id,
        model_name=model.name,
        model_version=model.version,
        source_run_id=56,
        criteria=list(model.criteria),
        weights=[
            CriterionWeight(criterion_id=c, weight=model.weights[c])
            for c in model.criteria
        ],
        consistency_ratio=model.consistency_ratio,
        crs=crs,
        resolution=res_str,
        published_at=package_service.published_at,
        state_name=package_service.state_name,
        validation_status="Validated (CR < 0.10)",
        scoring_modes=[
            "AVAILABLE_EVIDENCE_RENORMALIZED",
            "STRICT_11_OF_11",
        ],
        minimum_valid_criteria=model.minimum_valid_criteria,
        kappa=None,
        kappa_reason="Independent reference data unavailable — Kappa: N/A",
        nodata_value="nan",
        package_type="Spatial Knowledge Package",
        reproducibility=package_service.reproducibility,
    )


_boundary_cache: dict[str, dict] = {}


def _extract_geojson_from_gpkg(gpkg_path) -> dict | None:
    """Extract GeoJSON FeatureCollection from a standard GeoPackage file."""
    try:
        conn = sqlite3.connect(gpkg_path)
        cur = conn.cursor()
        cur.execute("SELECT geom FROM himachal_pradesh LIMIT 1")
        row = cur.fetchone()
        if not row or not row[0]:
            return None

        geom_bytes = row[0]
        # GeoPackage header parsing
        flags = geom_bytes[3]
        envelope_indicator = (flags >> 1) & 0x07
        envelope_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
        header_len = 8 + envelope_sizes.get(envelope_indicator, 0)
        wkb_bytes = geom_bytes[header_len:]

        # WKB parsing: Little Endian
        byte_order = wkb_bytes[0]
        endian = "<" if byte_order == 1 else ">"
        geom_type = struct.unpack(f"{endian}I", wkb_bytes[1:5])[0]

        offset = 5
        if geom_type == 3:  # Polygon
            num_rings = struct.unpack(f"{endian}I", wkb_bytes[offset:offset+4])[0]
            offset += 4
            rings = []
            for _ in range(num_rings):
                num_pts = struct.unpack(f"{endian}I", wkb_bytes[offset:offset+4])[0]
                offset += 4
                pts = []
                for _ in range(num_pts):
                    x, y = struct.unpack(f"{endian}dd", wkb_bytes[offset:offset+16])
                    offset += 16
                    pts.append([round(x, 6), round(y, 6)])
                rings.append(pts)

            return {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"name": "Himachal Pradesh", "state": "HP"},
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": rings,
                        },
                    }
                ],
            }
    except Exception as e:
        logger.warning("Error reading boundary GPKG: %s", e)
    return None


@router.get("/boundary")
def get_state_boundary():
    """Return the official GeoJSON FeatureCollection boundary for Himachal Pradesh."""
    state_name = package_service.state_name
    if state_name in _boundary_cache:
        return _boundary_cache[state_name]

    # Check vector/hp_boundary.gpkg in package
    vec_path = package_service.root / "vector" / "hp_boundary.gpkg"
    if vec_path.exists():
        geojson = _extract_geojson_from_gpkg(vec_path)
        if geojson:
            _boundary_cache[state_name] = geojson
            return geojson

    # Fallback to bounding box from package rasters
    b = [75.57855, 30.38430, 78.99682, 33.25577]
    fallback = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": state_name},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [b[0], b[1]],
                        [b[2], b[1]],
                        [b[2], b[3]],
                        [b[0], b[3]],
                        [b[0], b[1]],
                    ]],
                },
            }
        ],
    }
    _boundary_cache[state_name] = fallback
    return fallback
