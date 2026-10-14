"""
Spatial Knowledge Repository Layer.

Manifest-driven, model-agnostic abstraction for accessing the Himachal Pradesh
Spatial Knowledge Package(s).

Key Features:
- Resolves package locations strictly via environment variables (never hardcoded)
- Manifest-driven: never recursively searches arbitrary files during requests
- Safe path resolution: prevents directory traversal attacks
- Supports hybrid packages containing multiple models (Flood, Landslide, future hazards)
- Multi-model point sampling, metadata discovery, and boundary serving
- Windowed reads: never loads entire statewide rasters into memory
"""

from __future__ import annotations

import json
import logging
import math
import sqlite3
import struct
from pathlib import Path
from typing import Any

import rasterio
from pyproj import Transformer
from rasterio.windows import Window

from app.config import settings
from app.services.weights import get_model_config

logger = logging.getLogger(__name__)

# Category definitions
CATEGORY_HYDRO = "Hydrological Criteria"
CATEGORY_TOPO = "Topographic Criteria"
CATEGORY_ENV = "Environmental Criteria"
CATEGORY_GEO = "Geological Criteria"
CATEGORY_RESULTS = "Analysis Results"
CATEGORY_QUALITY = "Quality & Coverage"

CRITERION_CATEGORIES: dict[str, str] = {
    "rainfall": CATEGORY_HYDRO,
    "rainfall_10_year": CATEGORY_HYDRO,
    "distance_to_rivers": CATEGORY_HYDRO,
    "flow_accumulation": CATEGORY_HYDRO,
    "twi": CATEGORY_HYDRO,
    "drainage_density": CATEGORY_HYDRO,
    "elevation": CATEGORY_TOPO,
    "slope": CATEGORY_TOPO,
    "aspect": CATEGORY_TOPO,
    "curvature": CATEGORY_TOPO,
    "relative_relief": CATEGORY_TOPO,
    "lithology": CATEGORY_GEO,
    "geomorphology": CATEGORY_GEO,
    "lineament_density": CATEGORY_GEO,
    "distance_to_faults": CATEGORY_GEO,
    "distance_to_roads": CATEGORY_ENV,
    "lulc": CATEGORY_ENV,
    "soil": CATEGORY_ENV,
    "ndvi": CATEGORY_ENV,
}

CRITERION_DISPLAY_NAMES: dict[str, str] = {
    "rainfall": "Rainfall",
    "rainfall_10_year": "10-Year Extreme Rainfall",
    "distance_to_rivers": "Distance to Rivers",
    "flow_accumulation": "Flow Accumulation",
    "twi": "Topographic Wetness Index (TWI)",
    "drainage_density": "Drainage Density",
    "elevation": "Elevation",
    "slope": "Terrain Slope",
    "aspect": "Terrain Aspect",
    "curvature": "Curvature",
    "relative_relief": "Relative Relief",
    "lithology": "Lithology",
    "geomorphology": "Geomorphology",
    "lineament_density": "Lineament Density",
    "distance_to_faults": "Distance to Faults",
    "distance_to_roads": "Distance to Roads",
    "lulc": "Land Use / Land Cover (LULC)",
    "soil": "Soil Texture & Permeability",
    "ndvi": "NDVI Vegetation Density",
}

CRITERION_UNITS: dict[str, str] = {
    "rainfall": "mm/yr",
    "rainfall_10_year": "mm/day",
    "distance_to_rivers": "m",
    "flow_accumulation": "cells",
    "twi": "index",
    "drainage_density": "km/km²",
    "elevation": "m asl",
    "slope": "°",
    "aspect": "°",
    "curvature": "1/m",
    "relative_relief": "m",
    "lithology": "class",
    "geomorphology": "class",
    "lineament_density": "km/km²",
    "distance_to_faults": "m",
    "distance_to_roads": "m",
    "lulc": "class",
    "soil": "class",
    "ndvi": "index",
}

_transformers: dict[str, Transformer] = {}


def _get_transformer(src_crs: str, dst_crs: str) -> Transformer:
    """Return cached coordinate transformer."""
    key = f"{src_crs}->{dst_crs}"
    if key not in _transformers:
        _transformers[key] = Transformer.from_crs(src_crs, dst_crs, always_xy=True)
    return _transformers[key]


class SpatialKnowledgeRepository:
    """
    Repository layer for the Spatial Knowledge Package.
    Enforces safe path resolution, dynamic model discovery, and standardized layer metadata.
    """

    def __init__(self) -> None:
        self.packages: dict[str, dict] = {}  # root_path_str -> package_dict
        self.models: dict[str, dict] = {}  # model_id -> model_meta
        self.layers: list[dict] = []  # all canonical layers
        self._layers_by_product_id: dict[str, dict] = {}
        self._layers_by_model: dict[str, list[dict]] = {}
        self.aliases: dict[str, dict] = {}
        self.loaded = False
        self._boundary_cache: dict[str, dict] = {}

    def load(self) -> None:
        """
        Discover and load all canonical packages configured via environment variables.
        Loads manifest.json and metadata/ files for each package.
        """
        logger.info("Initializing Spatial Knowledge Repository")
        all_roots = settings.all_configured_roots()
        if not all_roots:
            logger.warning("No valid spatial knowledge roots found in settings.")
            return

        self.packages.clear()
        self.models.clear()
        self.layers.clear()
        self._layers_by_product_id.clear()
        self._layers_by_model.clear()
        self.aliases.clear()

        for root in all_roots:
            self._load_package(root)

        self.loaded = True
        logger.info(
            "Spatial Knowledge Repository loaded successfully: %d models, %d layers across %d packages",
            len(self.models),
            len(self.layers),
            len(self.packages),
        )

    def _load_package(self, root: Path) -> None:
        """Load a single Spatial Knowledge Package directory."""
        manifest_path = root / "manifest.json"
        if not manifest_path.exists():
            logger.warning("No manifest.json in package at: %s", root.name)
            return

        try:
            with open(manifest_path, encoding="utf-8") as f:
                manifest = json.load(f)
        except Exception as e:
            logger.error("Failed to parse manifest.json in %s: %s", root.name, e)
            return

        model_id = manifest.get("model_id", "unknown_model")
        state_name = manifest.get("state_name", "Himachal Pradesh")

        # Load metadata files
        metadata_dir = root / "metadata"
        meta_files: dict[str, Any] = {}
        if metadata_dir.exists():
            for fname in [
                "model_info.json",
                "lineage.json",
                "dataset_provenance.json",
                "reproducibility.json",
                "package_inventory.json",
            ]:
                fp = metadata_dir / fname
                if fp.exists():
                    try:
                        with open(fp, encoding="utf-8") as f:
                            meta_files[fname.replace(".json", "")] = json.load(f)
                    except Exception as e:
                        logger.warning(
                            "Could not read %s in %s: %s", fname, root.name, e
                        )

        # Merge aliases
        pkg_aliases = manifest.get("aliases", {})
        self.aliases.update(pkg_aliases)

        package_info = {
            "root": root,
            "manifest": manifest,
            "metadata": meta_files,
            "state_name": state_name,
            "model_id": model_id,
            "package_version": manifest.get("package_version", "1.0"),
            "spec_version": manifest.get("spec_version", "1.0"),
            "published_at": manifest.get("published_at", ""),
            "target_crs": manifest.get("target_crs", "EPSG:4326"),
        }
        self.packages[str(root)] = package_info

        # Register model
        model_name = "Susceptibility Model"
        if "flood" in model_id.lower():
            model_name = "11-Factor Flood Susceptibility AHP"
        elif "landslide" in model_id.lower():
            model_name = "14-Factor Landslide Susceptibility MCDA"
        elif "model_info" in meta_files and "model_name" in meta_files["model_info"]:
            model_name = meta_files["model_info"]["model_name"]

        model_cfg = get_model_config(model_id)

        self.models[model_id] = {
            "model_id": model_id,
            "name": model_name,
            "package_root": root,
            "manifest": manifest,
            "metadata": meta_files,
            "criterion_count": len(model_cfg.criteria)
            if model_cfg
            else len(meta_files.get("model_info", {}).get("criteria", [])),
            "consistency_ratio": model_cfg.consistency_ratio if model_cfg else 0.0,
            "state_name": state_name,
        }

        # Process layers
        raw_layers = manifest.get("layers", [])
        model_layers = []

        for layer in raw_layers:
            # Skip non-raster or boundary-only layers from general layer catalog
            ltype = layer.get("layer_type") or layer.get("type") or ""
            if "vector" in ltype.lower():
                continue

            # Determine product ID
            pid = layer.get("product_id")
            if not pid:
                layer_name = layer.get("layer_name") or layer.get("name") or ""
                # Strip type prefix e.g. "factor_raster:slope" -> "slope"
                if ":" in layer_name:
                    prefix, name_part = layer_name.split(":", 1)
                    if prefix == "factor_raster":
                        pid = name_part
                    elif prefix == "rating_raster":
                        pid = f"{name_part}_rating"
                    elif prefix == "result_raster":
                        pid = f"{model_id}_{name_part}"
                    elif prefix == "quality_mask":
                        pid = f"{model_id}_{name_part}"
                    else:
                        pid = name_part
                else:
                    pid = layer_name

            if not pid:
                continue

            rel_path = layer.get("relative_path") or layer.get("target_path") or ""
            rel_path = rel_path.replace("\\", "/")

            # Safe verification: check file exists within root
            try:
                full_path = self.safe_resolve_raster_path(root, rel_path)
                file_exists = full_path.exists()
            except ValueError:
                file_exists = False
                logger.warning("Unsafe path rejected in manifest: %s", rel_path)

            criterion_id = layer.get("criterion_id", "")
            if not criterion_id and pid:
                criterion_id = pid.replace("_rating", "")

            # Determine layer semantic type and category
            is_result = "result" in ltype.lower() or "suitability" in pid.lower()
            is_quality = (
                "quality" in ltype.lower()
                or "criteria" in pid.lower()
                or "mask" in ltype.lower()
            )
            is_rating = "rating" in ltype.lower() or pid.endswith("_rating")

            if is_result:
                sem_type = "RESULT"
                category = CATEGORY_RESULTS
            elif is_quality:
                sem_type = "QUALITY"
                category = CATEGORY_QUALITY
            elif is_rating:
                sem_type = "RATING"
                category = CRITERION_CATEGORIES.get(criterion_id, CATEGORY_ENV)
            else:
                sem_type = "FACTOR"
                category = CRITERION_CATEGORIES.get(criterion_id, CATEGORY_ENV)

            # Build semantic display name
            display_name = self._build_display_name(
                pid, criterion_id, sem_type, model_id
            )

            # Spatial resolution
            rx = abs(float(layer.get("resolution_x", 30.0)))
            if rx < 0.01:
                # Degree units
                res_str = f"~{round(rx * 111320, 1)} m"
            else:
                res_str = f"{round(rx)} m"

            layer_dict = {
                "product_id": pid,
                "display_name": display_name,
                "criterion_id": criterion_id,
                "type": sem_type,
                "layer_type": ltype or f"{sem_type.lower()}_raster",
                "category": category,
                "model": model_id,
                "unit": CRITERION_UNITS.get(criterion_id, layer.get("unit", "")),
                "crs": layer.get("crs", manifest.get("target_crs", "EPSG:4326")),
                "resolution": res_str,
                "resolution_x": rx,
                "resolution_y": abs(float(layer.get("resolution_y", rx))),
                "width": int(layer.get("width", 0)),
                "height": int(layer.get("height", 0)),
                "bounds": layer.get("bounds", []),
                "nodata_value": str(layer.get("nodata_value", "nan")),
                "scoring_mode": layer.get("scoring_mode"),
                "status": "published" if file_exists else "missing_on_disk",
                "relative_path": rel_path,
                "package_root": str(root),
                "alias_of": None,
                "valid_pixel_pct": float(layer.get("valid_pixel_pct", 0.0)),
                "description": layer.get(
                    "description", f"{sem_type} layer for {display_name}"
                ),
                # Compatibility keys
                "layer_id": pid,
                "layer_name": pid,
                "canonical_filename": Path(rel_path).name,
            }

            model_layers.append(layer_dict)
            self._layers_by_product_id[pid] = layer_dict
            # Also index by layer_name and relative_path basename
            if layer.get("layer_name") and layer["layer_name"] != pid:
                self._layers_by_product_id[layer["layer_name"]] = layer_dict

        self._layers_by_model[model_id] = model_layers
        self.layers.extend(model_layers)

    def _build_display_name(
        self, product_id: str, criterion_id: str, sem_type: str, model_id: str
    ) -> str:
        """Create a user-friendly, clean semantic display name for a layer."""
        crit_label = CRITERION_DISPLAY_NAMES.get(
            criterion_id, criterion_id.replace("_", " ").title()
        )
        is_landslide = "landslide" in model_id.lower()

        if sem_type == "FACTOR":
            return f"{crit_label} — Raw"
        if sem_type == "RATING":
            return f"{crit_label} — Rating (1–5)"
        if sem_type == "QUALITY":
            if "valid_criteria" in product_id:
                return "Evidence Coverage"
            if "missing_criteria" in product_id:
                return "Missing Criteria Bitmask"
            return "Quality Mask"
        if sem_type == "RESULT":
            prefix = "Landslide" if is_landslide else "Flood"
            if "classified" in product_id:
                if "strict" in product_id:
                    return f"Strict {prefix} Susceptibility — Classified"
                return f"{prefix} Susceptibility — Classified"
            else:
                if "strict" in product_id:
                    return f"Strict {prefix} Susceptibility — Continuous"
                return f"{prefix} Susceptibility — Continuous"

        return product_id.replace("_", " ").title()

    def safe_resolve_raster_path(self, package_root: Path, relative_path: str) -> Path:
        """
        Safely resolve a relative raster path against the package root.
        Guarantees path traversal rejection (e.g. '../' attacks).
        """
        if not relative_path:
            raise ValueError("Empty relative path")
        rel = Path(relative_path)
        if rel.is_absolute():
            raise ValueError(f"Unsafe absolute path: {relative_path}")

        root_resolved = package_root.resolve()
        target = (package_root / rel).resolve()

        # Strict containment check
        try:
            target.relative_to(root_resolved)
        except ValueError as err:
            raise ValueError(
                f"Path traversal detected: {relative_path} escapes package root"
            ) from err

        return target

    def get_layer(self, layer_id: str, model_id: str | None = None) -> dict | None:
        """
        Lookup layer metadata by product_id, alias, or layer_name.
        Resolves legacy aliases transparently without duplicate files.
        """
        if not layer_id:
            return None

        cleaned = layer_id.strip()
        if ":" in cleaned:
            cleaned = cleaned.split(":")[-1]

        # 1. Check aliases
        if cleaned in self.aliases:
            target = self.aliases[cleaned].get("target")
            if target and target in self._layers_by_product_id:
                return self._layers_by_product_id[target]

        # 2. Check direct product_id
        if cleaned in self._layers_by_product_id:
            return self._layers_by_product_id[cleaned]

        # 3. Model-scoped search if model_id provided
        search_space = (
            self._layers_by_model.get(model_id, self.layers)
            if model_id
            else self.layers
        )

        for layer in search_space:
            if layer["product_id"].lower() == cleaned.lower():
                return layer
            if (
                layer.get("canonical_filename", "").lower() == f"{cleaned.lower()}.tif"
                or layer.get("canonical_filename", "").lower() == cleaned.lower()
            ):
                return layer
            if cleaned.lower() in layer["relative_path"].lower():
                return layer

        return None

    def get_layers_for_model(self, model_id: str | None = None) -> list[dict]:
        """Return all layers belonging to a model, or all layers if model_id is None."""
        if not model_id:
            return self.layers
        return self._layers_by_model.get(model_id, [])

    def get_raster_path_for_layer(self, layer: dict) -> Path:
        """Return the verified absolute path for a layer dict."""
        root = Path(layer["package_root"])
        return self.safe_resolve_raster_path(root, layer["relative_path"])

    def sample_raster_at(
        self, raster_path: Path, lat: float, lon: float
    ) -> tuple[float | None, str]:
        """
        Perform a 1x1 windowed read at WGS84 (lat, lon).
        Automatically transforms coordinates to the raster's native CRS.
        Strictly preserves NoData without substituting zero.
        """
        if not raster_path.exists():
            return None, ""

        try:
            with rasterio.open(raster_path) as ds:
                crs_str = str(ds.crs) if ds.crs else "EPSG:4326"
                if ds.crs and str(ds.crs) != "EPSG:4326":
                    transformer = _get_transformer("EPSG:4326", str(ds.crs))
                    x, y = transformer.transform(lon, lat)
                else:
                    x, y = lon, lat

                # Bounds check in native coordinate space
                left, bottom, right, top = ds.bounds
                if x < left or x > right or y < bottom or y > top:
                    return None, crs_str

                row, col = ds.index(x, y)
                if row < 0 or row >= ds.height or col < 0 or col >= ds.width:
                    return None, crs_str

                # Windowed 1x1 read
                window = Window(col, row, 1, 1)  # type: ignore[call-arg]  # pyright: ignore[reportCallIssue]
                data = ds.read(1, window=window)
                value = float(data[0, 0])

                # NoData check
                nodata = ds.nodata
                if nodata is not None:
                    if math.isnan(nodata) and math.isnan(value):
                        return None, crs_str
                    if value == nodata:
                        return None, crs_str
                if math.isnan(value):
                    return None, crs_str

                return value, crs_str
        except Exception as e:
            logger.debug(
                "Failed sampling %s at (%s, %s): %s", raster_path.name, lat, lon, e
            )
            return None, ""

    def get_state_boundary(self) -> dict:
        """Return the official GeoJSON boundary for Himachal Pradesh."""
        if "Himachal Pradesh" in self._boundary_cache:
            return self._boundary_cache["Himachal Pradesh"]

        # 1. Search for hp_boundary.gpkg in any configured package
        for pkg in self.packages.values():
            root = pkg["root"]
            vec_path = root / "vector" / "hp_boundary.gpkg"
            if vec_path.exists():
                geojson = self._extract_geojson_from_gpkg(vec_path)
                if geojson:
                    self._boundary_cache["Himachal Pradesh"] = geojson
                    return geojson

        # 2. Dynamic bounding box fallback from rasters
        # Canonical Himachal Pradesh study area extent
        b = [75.57855, 30.38430, 78.99682, 33.25577]
        fallback = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"name": "Himachal Pradesh", "state": "HP"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [b[0], b[1]],
                                [b[2], b[1]],
                                [b[2], b[3]],
                                [b[0], b[3]],
                                [b[0], b[1]],
                            ]
                        ],
                    },
                }
            ],
        }
        self._boundary_cache["Himachal Pradesh"] = fallback
        return fallback

    def _extract_geojson_from_gpkg(self, gpkg_path: Path) -> dict | None:
        """Extract GeoJSON FeatureCollection from a standard GeoPackage file."""
        try:
            conn = sqlite3.connect(gpkg_path)
            cur = conn.cursor()
            cur.execute("SELECT geom FROM himachal_pradesh LIMIT 1")
            row = cur.fetchone()
            if not row or not row[0]:
                return None

            geom_bytes = row[0]
            flags = geom_bytes[3]
            envelope_indicator = (flags >> 1) & 0x07
            envelope_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
            header_len = 8 + envelope_sizes.get(envelope_indicator, 0)
            wkb_bytes = geom_bytes[header_len:]

            byte_order = wkb_bytes[0]
            endian = "<" if byte_order == 1 else ">"
            geom_type = struct.unpack(f"{endian}I", wkb_bytes[1:5])[0]

            offset = 5
            if geom_type == 3:  # Polygon
                num_rings = struct.unpack(f"{endian}I", wkb_bytes[offset : offset + 4])[
                    0
                ]
                offset += 4
                rings = []
                for _ in range(num_rings):
                    num_pts = struct.unpack(
                        f"{endian}I", wkb_bytes[offset : offset + 4]
                    )[0]
                    offset += 4
                    pts = []
                    for _ in range(num_pts):
                        x, y = struct.unpack(
                            f"{endian}dd", wkb_bytes[offset : offset + 16]
                        )
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


# Global singleton instance
repository = SpatialKnowledgeRepository()
