"""
Spatial-package discovery and metadata service (Backward Compatibility Adapter).

Delegates to the canonical SpatialKnowledgeRepository while preserving the original
API surface for existing routes, tests, and callers.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.config import settings
from app.services.repository import repository

logger = logging.getLogger(__name__)


class PackageService:
    """Compatibility wrapper delegating to SpatialKnowledgeRepository."""

    def __init__(self) -> None:
        self.repo = repository

    def load(self) -> None:
        """Load repository packages and models."""
        self.repo.load()

    @property
    def root(self) -> Path:
        """Default package root."""
        return settings.get_package_root()

    @property
    def manifest(self) -> dict:
        """Manifest of the primary/default package."""
        if not self.repo.packages:
            return {}
        first_pkg = next(iter(self.repo.packages.values()))
        return first_pkg.get("manifest", {})

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
        return int(
            self.manifest.get("source_run_id", 56 if "flood" in self.model_id else 63)
        )

    @property
    def published_at(self) -> str:
        return str(self.manifest.get("published_at", ""))

    @property
    def layers(self) -> list[dict]:
        """Return canonical layers (Flood layers prioritized for legacy Flood callers)."""
        flood_layers = self.repo.get_layers_for_model("flood_11_factor_v1")
        if flood_layers:
            return flood_layers
        return self.repo.layers

    @property
    def all_layers(self) -> list[dict]:
        """All layers across all loaded models."""
        return self.repo.layers

    @property
    def aliases(self) -> dict[str, dict]:
        return self.repo.aliases

    @property
    def reproducibility(self) -> dict:
        if not self.repo.packages:
            return {}
        first_pkg = next(iter(self.repo.packages.values()))
        return first_pkg.get("metadata", {}).get("reproducibility", {})

    @property
    def provenance(self) -> dict:
        if not self.repo.packages:
            return {}
        first_pkg = next(iter(self.repo.packages.values()))
        return first_pkg.get("metadata", {}).get("dataset_provenance", {})

    @property
    def total_published_rasters(self) -> int:
        return len(self.layers)

    @property
    def factor_count(self) -> int:
        return len([layer for layer in self.layers if layer.get("type") == "FACTOR"])

    @property
    def rating_count(self) -> int:
        return len([layer for layer in self.layers if layer.get("type") == "RATING"])

    @property
    def result_count(self) -> int:
        return len([layer for layer in self.layers if layer.get("type") == "RESULT"])

    @property
    def quality_count(self) -> int:
        return len([layer for layer in self.layers if layer.get("type") == "QUALITY"])

    def get_layer(self, layer_id: str) -> dict | None:
        """Lookup layer across repository with alias resolution."""
        return self.repo.get_layer(layer_id)

    def get_raster_path(self, relative_path: str) -> Path:
        """Resolve raster path safely using default package root."""
        return self.repo.safe_resolve_raster_path(self.root, relative_path)

    def factor_layers(self) -> list[dict]:
        return [layer for layer in self.layers if layer.get("type") == "FACTOR"]

    def rating_layers(self) -> list[dict]:
        return [layer for layer in self.layers if layer.get("type") == "RATING"]

    def result_layers(self) -> list[dict]:
        return [layer for layer in self.layers if layer.get("type") == "RESULT"]

    def quality_layers(self) -> list[dict]:
        return [layer for layer in self.layers if layer.get("type") == "QUALITY"]


# Global singleton instance
package_service = PackageService()
