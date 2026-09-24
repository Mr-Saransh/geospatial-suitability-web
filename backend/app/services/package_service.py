"""
Spatial-package discovery and metadata service.

Reads manifest.json and metadata/ files from the canonical
Himachal Pradesh Spatial Knowledge Package, discovers all 28 published rasters,
enriches them with semantic metadata, resolves legacy aliases, and exposes
package health and catalog queries.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)

# Semantic mapping for products
PRODUCT_METADATA: dict[str, dict[str, Any]] = {
    # ── Hydrological Factors & Ratings ──
    "rainfall": {
        "display_name": "Rainfall — Raw",
        "category": "Hydrological Criteria",
        "type": "FACTOR",
        "unit": "mm/yr",
        "criterion_id": "rainfall",
        "description": "Standardized annual rainfall precipitation raster (CHIRPS / IMD)",
    },
    "rainfall_rating": {
        "display_name": "Rainfall — Rating (1–5)",
        "category": "Hydrological Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "rainfall",
        "description": "AHP rating product for rainfall (1: Very Low to 5: Very High)",
    },
    "distance_to_rivers": {
        "display_name": "Distance to Rivers — Raw",
        "category": "Hydrological Criteria",
        "type": "FACTOR",
        "unit": "m",
        "criterion_id": "distance_to_rivers",
        "description": "Proximity to river corridors (HydroRIVERS / OSM)",
    },
    "distance_to_rivers_rating": {
        "display_name": "Distance to Rivers — Rating (1–5)",
        "category": "Hydrological Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "distance_to_rivers",
        "description": "AHP rating product for distance to rivers (1: Far to 5: Immediate corridor)",
    },
    "drainage_density": {
        "display_name": "Drainage Density — Raw",
        "category": "Hydrological Criteria",
        "type": "FACTOR",
        "unit": "km/km²",
        "criterion_id": "drainage_density",
        "description": "Stream network length per basin area",
    },
    "drainage_density_rating": {
        "display_name": "Drainage Density — Rating (1–5)",
        "category": "Hydrological Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "drainage_density",
        "description": "AHP rating product for drainage density (1–5)",
    },
    "flow_accumulation": {
        "display_name": "Flow Accumulation — Raw",
        "category": "Hydrological Criteria",
        "type": "FACTOR",
        "unit": "cells",
        "criterion_id": "flow_accumulation",
        "description": "Contributing upstream drainage area (SRTM D8)",
    },
    "flow_accumulation_rating": {
        "display_name": "Flow Accumulation — Rating (1–5)",
        "category": "Hydrological Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "flow_accumulation",
        "description": "AHP rating product for flow accumulation (1–5)",
    },
    "twi": {
        "display_name": "TWI — Raw",
        "category": "Hydrological Criteria",
        "type": "FACTOR",
        "unit": "index",
        "criterion_id": "twi",
        "description": "Topographic Wetness Index quantifying moisture retention",
    },
    "twi_rating": {
        "display_name": "TWI — Rating (1–5)",
        "category": "Hydrological Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "twi",
        "description": "AHP rating product for Topographic Wetness Index (1–5)",
    },

    # ── Topographic Factors & Ratings ──
    "elevation": {
        "display_name": "Elevation — Raw",
        "category": "Topographic Criteria",
        "type": "FACTOR",
        "unit": "m asl",
        "criterion_id": "elevation",
        "description": "Digital elevation model (SRTM 30 m DEM)",
    },
    "elevation_rating": {
        "display_name": "Elevation — Rating (1–5)",
        "category": "Topographic Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "elevation",
        "description": "AHP rating product for elevation (1: Mountain peak to 5: Low valley)",
    },
    "slope": {
        "display_name": "Slope — Raw",
        "category": "Topographic Criteria",
        "type": "FACTOR",
        "unit": "°",
        "criterion_id": "slope",
        "description": "Terrain slope gradient in degrees",
    },
    "slope_rating": {
        "display_name": "Slope — Rating (1–5)",
        "category": "Topographic Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "slope",
        "description": "AHP rating product for slope (1: Steep slope to 5: Flat valley bottom)",
    },
    "curvature": {
        "display_name": "Curvature — Raw",
        "category": "Topographic Criteria",
        "type": "FACTOR",
        "unit": "1/m",
        "criterion_id": "curvature",
        "description": "Profile/plan terrain curvature (convex vs concave)",
    },
    "curvature_rating": {
        "display_name": "Curvature — Rating (1–5)",
        "category": "Topographic Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "curvature",
        "description": "AHP rating product for curvature (1: Convex to 5: Concave)",
    },

    # ── Environmental Factors & Ratings ──
    "lulc": {
        "display_name": "LULC — Raw",
        "category": "Environmental Criteria",
        "type": "FACTOR",
        "unit": "class",
        "criterion_id": "lulc",
        "description": "Land Use / Land Cover classification (ESA WorldCover 10 m)",
    },
    "lulc_rating": {
        "display_name": "LULC — Rating (1–5)",
        "category": "Environmental Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "lulc",
        "description": "AHP rating product for Land Use / Land Cover (1: Forest to 5: Built-up/Water)",
    },
    "soil": {
        "display_name": "Soil — Raw",
        "category": "Environmental Criteria",
        "type": "FACTOR",
        "unit": "class",
        "criterion_id": "soil",
        "description": "Soil textural classification and infiltration capacity (SoilGrids v2.0)",
    },
    "soil_rating": {
        "display_name": "Soil — Rating (1–5)",
        "category": "Environmental Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "soil",
        "description": "AHP rating product for soil texture (1: Well-drained to 5: Heavy clay/impervious)",
    },
    "ndvi": {
        "display_name": "NDVI — Raw",
        "category": "Environmental Criteria",
        "type": "FACTOR",
        "unit": "index",
        "criterion_id": "ndvi",
        "description": "Normalised Difference Vegetation Index (Sentinel-2 L2A)",
    },
    "ndvi_rating": {
        "display_name": "NDVI — Rating (1–5)",
        "category": "Environmental Criteria",
        "type": "RATING",
        "unit": "rating (1–5)",
        "criterion_id": "ndvi",
        "description": "AHP rating product for NDVI (1: Dense canopy to 5: Sparse/barren)",
    },

    # ── Analysis Results (Ordered for UI) ──
    "flood_11_factor_v1_available_evidence_suitability_classified": {
        "display_name": "Flood Suitability — Classified",
        "category": "Analysis Results",
        "type": "RESULT",
        "unit": "class (1–5)",
        "criterion_id": "",
        "scoring_mode": "AVAILABLE_EVIDENCE_RENORMALIZED",
        "description": "Canonical user-facing classified 5-class flood suitability (Available-Evidence Renormalized)",
    },
    "flood_11_factor_v1_available_evidence_suitability": {
        "display_name": "Flood Suitability — Continuous",
        "category": "Analysis Results",
        "type": "RESULT",
        "unit": "score (1.0–5.0)",
        "criterion_id": "",
        "scoring_mode": "AVAILABLE_EVIDENCE_RENORMALIZED",
        "description": "Canonical user-facing continuous flood suitability index (Available-Evidence Renormalized)",
    },
    "flood_11_factor_v1_strict_suitability_classified": {
        "display_name": "Strict Suitability — Classified",
        "category": "Analysis Results",
        "type": "RESULT",
        "unit": "class (1–5)",
        "criterion_id": "",
        "scoring_mode": "STRICT_11_OF_11",
        "description": "Strict 11-of-11 audit classified flood suitability (requires all 11 factors)",
    },
    "flood_11_factor_v1_strict_suitability": {
        "display_name": "Strict Suitability — Continuous",
        "category": "Analysis Results",
        "type": "RESULT",
        "unit": "score (1.0–5.0)",
        "criterion_id": "",
        "scoring_mode": "STRICT_11_OF_11",
        "description": "Strict 11-of-11 audit continuous flood suitability (requires all 11 factors)",
    },

    # ── Quality & Coverage ──
    "flood_11_factor_v1_valid_criteria_count": {
        "display_name": "Evidence Coverage",
        "category": "Quality & Coverage",
        "type": "QUALITY",
        "unit": "criteria count (8–11)",
        "criterion_id": "",
        "description": "Spatial count of valid criteria per pixel (8 to 11 valid factors)",
    },
    "flood_11_factor_v1_missing_criteria_bitmask": {
        "display_name": "Missing Criteria",
        "category": "Quality & Coverage",
        "type": "QUALITY",
        "unit": "bitmask",
        "criterion_id": "",
        "description": "Bitmask encoding valid/missing criteria flags (2047: all valid)",
    },
}

# Desired catalog display order
PRODUCT_ORDER = [
    # 1. User-Facing Results First
    "flood_11_factor_v1_available_evidence_suitability_classified",
    "flood_11_factor_v1_available_evidence_suitability",
    "flood_11_factor_v1_strict_suitability_classified",
    "flood_11_factor_v1_strict_suitability",
    # 2. Hydrological Criteria & Ratings
    "rainfall",
    "distance_to_rivers",
    "drainage_density",
    "flow_accumulation",
    "twi",
    "rainfall_rating",
    "distance_to_rivers_rating",
    "drainage_density_rating",
    "flow_accumulation_rating",
    "twi_rating",
    # 3. Topographic Criteria & Ratings
    "elevation",
    "slope",
    "curvature",
    "elevation_rating",
    "slope_rating",
    "curvature_rating",
    # 4. Environmental Criteria & Ratings
    "lulc",
    "soil",
    "ndvi",
    "lulc_rating",
    "soil_rating",
    "ndvi_rating",
    # 5. Quality & Coverage
    "flood_11_factor_v1_valid_criteria_count",
    "flood_11_factor_v1_missing_criteria_bitmask",
]


class PackageService:
    """Reads, validates, and manages the Himachal Pradesh Spatial Knowledge Package."""

    def __init__(self) -> None:
        self.root: Path = settings.spatial_knowledge_root
        self.manifest: dict = {}
        self.layers: list[dict] = []
        self._layers_by_product_id: dict[str, dict] = {}
        self.model_info: dict = {}
        self.inventory: dict = {}
        self.provenance: dict = {}
        self.reproducibility: dict = {}
        self.validation_report: dict = {}
        self.aliases: dict[str, dict] = {}
        self.criteria_bit_mapping: dict[str, int] = {}
        self._loaded = False

    def load(self) -> None:
        """Read manifest and metadata, enrich layers, and validate rasters on disk."""
        logger.info("Loading canonical spatial package from configured root")

        manifest_path = self.root / "manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"manifest.json not found inside package.")
        with open(manifest_path, "r", encoding="utf-8") as f:
            self.manifest = json.load(f)

        self.aliases = self.manifest.get("aliases", {})
        self.criteria_bit_mapping = self.manifest.get("criteria_bit_mapping", {})

        # Load metadata files
        meta_dir = self.root / "metadata"
        for fname, attr in [
            ("model_info.json", "model_info"),
            ("package_inventory.json", "inventory"),
            ("dataset_provenance.json", "provenance"),
            ("reproducibility.json", "reproducibility"),
            ("package_validation_report.json", "validation_report"),
        ]:
            p = meta_dir / fname
            if p.exists():
                with open(p, "r", encoding="utf-8") as f:
                    setattr(self, attr, json.load(f))

        # Discover and enrich layers
        raw_layers = self.manifest.get("layers", [])
        enriched: list[dict] = []

        for l in raw_layers:
            pid = l.get("product_id", "")
            meta = PRODUCT_METADATA.get(pid, {})

            rel_path = l.get("target_path") or l.get("relative_path") or ""
            # Ensure forward slashes for relative path
            rel_path = rel_path.replace("\\", "/")

            layer_dict = {
                "product_id": pid,
                "display_name": meta.get("display_name", pid.replace("_", " ").title()),
                "criterion_id": meta.get("criterion_id", l.get("criterion_id", "")),
                "type": meta.get("type", "FACTOR"),
                "layer_type": l.get("layer_type", "factor_raster"),
                "category": meta.get("category", "General"),
                "model": self.model_id,
                "unit": meta.get("unit", ""),
                "crs": l.get("crs", "EPSG:4326"),
                "resolution": f"~{round(abs(l.get('resolution_x', 0.00027)) * 111320, 1)} m",
                "resolution_x": l.get("resolution_x", 0.0),
                "resolution_y": l.get("resolution_y", 0.0),
                "width": l.get("width", 0),
                "height": l.get("height", 0),
                "bounds": l.get("bounds", []),
                "nodata_value": str(l.get("nodata_value", "nan")),
                "scoring_mode": meta.get("scoring_mode"),
                "status": "published",
                "relative_path": rel_path,
                "alias_of": None,
                "valid_pixel_pct": l.get("valid_pixel_pct", 0.0),
                "description": meta.get("description", l.get("description", "")),
                # Backwards compatibility keys
                "layer_id": pid,
                "layer_name": pid,
                "canonical_filename": l.get("canonical_filename", f"{pid}.tif"),
            }
            enriched.append(layer_dict)

        # Sort layers according to canonical PRODUCT_ORDER
        order_map = {pid: i for i, pid in enumerate(PRODUCT_ORDER)}
        enriched.sort(key=lambda item: order_map.get(item["product_id"], 999))

        self.layers = enriched
        self._layers_by_product_id = {l["product_id"]: l for l in self.layers}

        # Validate that all referenced rasters physically exist
        missing = []
        for l in self.layers:
            full_path = self.root / l["relative_path"]
            if not full_path.exists():
                missing.append(l["relative_path"])

        if missing:
            logger.warning("Missing raster files in package: %s", missing)
        else:
            logger.info("All %d published rasters validated on disk ✓", len(self.layers))

        self._loaded = True

    # ── Properties ──────────────────────────────────────────
    @property
    def state_name(self) -> str:
        return self.manifest.get("state_name", "Himachal Pradesh")

    @property
    def model_id(self) -> str:
        return self.manifest.get("model_id", "flood_11_factor_v1")

    @property
    def package_version(self) -> str:
        return str(self.manifest.get("package_version", "1.0"))

    @property
    def source_run_id(self) -> int:
        return int(self.manifest.get("source_run_id", 56))

    @property
    def published_at(self) -> str:
        return str(self.manifest.get("published_at", ""))

    @property
    def total_published_rasters(self) -> int:
        return len(self.layers)

    @property
    def factor_count(self) -> int:
        return len([l for l in self.layers if l.get("type") == "FACTOR"])

    @property
    def rating_count(self) -> int:
        return len([l for l in self.layers if l.get("type") == "RATING"])

    @property
    def result_count(self) -> int:
        return len([l for l in self.layers if l.get("type") == "RESULT"])

    @property
    def quality_count(self) -> int:
        return len([l for l in self.layers if l.get("type") == "QUALITY"])

    # ── Lookups ─────────────────────────────────────────────
    def get_layer(self, layer_id: str) -> Optional[dict]:
        """
        Lookup layer by product_id, alias, or legacy ID.
        Resolves aliases transparently without requiring physical duplicate files.
        """
        if not layer_id:
            return None

        # Clean prefix if provided (e.g., 'factor_raster:rainfall' -> 'rainfall')
        cleaned = layer_id
        if ":" in cleaned:
            cleaned = cleaned.split(":")[-1]

        # Check aliases dictionary
        if cleaned in self.aliases:
            target_id = self.aliases[cleaned].get("target")
            if target_id and target_id in self._layers_by_product_id:
                return self._layers_by_product_id[target_id]

        # Direct product_id match
        if cleaned in self._layers_by_product_id:
            return self._layers_by_product_id[cleaned]

        # Check by filename / relative path
        for l in self.layers:
            if l["product_id"].lower() == cleaned.lower():
                return l
            if l["canonical_filename"].lower() == f"{cleaned.lower()}.tif" or l["canonical_filename"].lower() == cleaned.lower():
                return l
            if cleaned.lower() in l["relative_path"].lower():
                return l

        return None

    def get_raster_path(self, relative_path: str) -> Path:
        """Return the absolute Path for a relative raster path."""
        return self.root / relative_path

    def factor_layers(self) -> list[dict]:
        return [l for l in self.layers if l.get("type") == "FACTOR"]

    def rating_layers(self) -> list[dict]:
        return [l for l in self.layers if l.get("type") == "RATING"]

    def result_layers(self) -> list[dict]:
        return [l for l in self.layers if l.get("type") == "RESULT"]

    def quality_layers(self) -> list[dict]:
        return [l for l in self.layers if l.get("type") == "QUALITY"]


# Global singleton instance
package_service = PackageService()
