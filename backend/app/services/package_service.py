"""
Spatial-package discovery and metadata service.

On startup the backend reads manifest.json and metadata/ files,
validates that referenced rasters exist, and caches the catalog.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class PackageService:
    """Reads and caches the Himachal Pradesh Spatial Knowledge Package."""

    def __init__(self) -> None:
        self.root: Path = settings.spatial_knowledge_root
        self.manifest: dict = {}
        self.layers: list[dict] = []
        self.model_info: dict = {}
        self.provenance: dict = {}
        self.reproducibility: dict = {}
        self._loaded = False

    # ── bootstrap ───────────────────────────────────────────
    def load(self) -> None:
        """Read metadata files and validate package."""
        logger.info("Loading spatial package from %s", self.root)

        # manifest.json
        manifest_path = self.root / "manifest.json"
        if not manifest_path.exists():
            raise FileNotFoundError(f"manifest.json not found at {manifest_path}")
        with open(manifest_path, "r", encoding="utf-8") as f:
            self.manifest = json.load(f)

        self.layers = self.manifest.get("layers", [])
        logger.info(
            "Package: state=%s  model=%s  layers=%d",
            self.manifest.get("state_name"),
            self.manifest.get("model_id"),
            len(self.layers),
        )

        # metadata/ subdirectory
        meta_dir = self.root / "metadata"
        for name, attr in [
            ("model_info.json", "model_info"),
            ("dataset_provenance.json", "provenance"),
            ("reproducibility.json", "reproducibility"),
        ]:
            p = meta_dir / name
            if p.exists():
                with open(p, "r", encoding="utf-8") as f:
                    setattr(self, attr, json.load(f))
                logger.info("  Loaded %s", name)

        # Validate referenced rasters exist
        missing = []
        for layer in self.layers:
            rel = layer.get("relative_path", "")
            full = self.root / rel
            if not full.exists():
                missing.append(rel)
        if missing:
            logger.warning("Missing raster files: %s", missing)
        else:
            logger.info("  All %d raster files validated ✓", len(self.layers))

        self._loaded = True

    # ── queries ─────────────────────────────────────────────
    @property
    def state_name(self) -> str:
        return self.manifest.get("state_name", "Unknown")

    @property
    def model_id(self) -> str:
        return self.manifest.get("model_id", "unknown")

    @property
    def published_at(self) -> str:
        return self.manifest.get("published_at", "")

    def get_layers_by_type(self, layer_type: str) -> list[dict]:
        return [l for l in self.layers if l.get("layer_type") == layer_type]

    def get_layer(self, layer_id: str) -> Optional[dict]:
        for l in self.layers:
            name = l.get("layer_name", "")
            if name == layer_id or name.endswith(":" + layer_id) or name.split(":")[-1] == layer_id:
                return l
            if l.get("criterion_id") == layer_id:
                return l
            # Also check relative path matching
            if layer_id in l.get("relative_path", ""):
                return l
        return None

    def get_raster_path(self, relative_path: str) -> Path:
        return self.root / relative_path

    def factor_layers(self) -> list[dict]:
        return self.get_layers_by_type("factor_raster")

    def rating_layers(self) -> list[dict]:
        return self.get_layers_by_type("rating_raster")

    def result_layers(self) -> list[dict]:
        return self.get_layers_by_type("result_raster")


# Singleton
package_service = PackageService()
