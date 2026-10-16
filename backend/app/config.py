"""Backend configuration via environment variables.

Supports canonical Spatial Knowledge Package path resolution for local
development and cloud deployment without any hardcoded filesystem paths.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# Load .env from the backend directory
_backend_dir = Path(__file__).resolve().parent.parent
_env_path = _backend_dir / ".env"
load_dotenv(_env_path)


def _clean_path(raw: str | None, base_dir: Path) -> Path | None:
    """Parse a path string into a resolved Path, handling relative paths and quotes."""
    if not raw:
        return None
    cleaned = raw.strip().strip("'\"")
    if not cleaned:
        return None
    p = Path(cleaned)
    if p.is_absolute():
        return p.resolve()
    return (base_dir / p).resolve()


class SpatialKnowledgeSettings:
    """Application settings read strictly from environment / .env file."""

    def __init__(self) -> None:
        self.environment: str = os.getenv("ENVIRONMENT", "development")
        self.cors_origins_raw: str = os.getenv("CORS_ORIGINS", "*")

        # Base reference directory (project root, parent of backend)
        base = _backend_dir.parent

        # 1. Primary package root
        self._raw_root: str | None = os.getenv("SPATIAL_KNOWLEDGE_ROOT")
        self.spatial_knowledge_root: Path | None = _clean_path(self._raw_root, base)

        # 2. Model-specific package roots
        self._raw_flood_root: str | None = os.getenv("FLOOD_SPATIAL_KNOWLEDGE_ROOT")
        self.flood_spatial_knowledge_root: Path | None = _clean_path(
            self._raw_flood_root, base
        )

        self._raw_landslide_root: str | None = os.getenv(
            "LANDSLIDE_SPATIAL_KNOWLEDGE_ROOT"
        )
        self.landslide_spatial_knowledge_root: Path | None = _clean_path(
            self._raw_landslide_root, base
        )

        # 3. Local Ollama AI settings
        self.ollama_base_url: str = os.getenv(
            "OLLAMA_BASE_URL", "http://127.0.0.1:11434"
        ).rstrip("/")
        self.ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
        self.ollama_timeout: float = float(os.getenv("OLLAMA_TIMEOUT", "12.0"))
        self.ai_rate_limit_per_minute: int = int(
            os.getenv("AI_RATE_LIMIT_PER_MINUTE", "20")
        )
        self.ai_max_history: int = int(os.getenv("AI_MAX_HISTORY", "6"))
        self.ai_max_question_length: int = int(
            os.getenv("AI_MAX_QUESTION_LENGTH", "1000")
        )
        self.ai_max_concurrent_generations: int = int(
            os.getenv("AI_MAX_CONCURRENT_GENERATIONS", "2")
        )

    @property
    def default_package_root(self) -> Path | None:
        """Default package root for generic queries."""
        if self.spatial_knowledge_root and self.spatial_knowledge_root.exists():
            return self.spatial_knowledge_root
        if (
            self.landslide_spatial_knowledge_root
            and self.landslide_spatial_knowledge_root.exists()
        ):
            return self.landslide_spatial_knowledge_root
        if (
            self.flood_spatial_knowledge_root
            and self.flood_spatial_knowledge_root.exists()
        ):
            return self.flood_spatial_knowledge_root
        return self.spatial_knowledge_root

    @property
    def cors_origins(self) -> list[str]:
        """Parsed list of allowed CORS origins."""
        if not self.cors_origins_raw or self.cors_origins_raw.strip() == "*":
            return ["*"]
        return [
            origin.strip().strip("'\"").rstrip("/")
            for origin in self.cors_origins_raw.split(",")
            if origin.strip().strip("'\"")
        ]

    def get_package_root(self, model_id: str | None = None) -> Path:
        """
        Resolve the canonical package root for a specific model with fallback priority:
        1. Model-specific environment variable (FLOOD_... / LANDSLIDE_...)
        2. SPATIAL_KNOWLEDGE_ROOT
        3. Raise FileNotFoundError if no valid root is resolved
        """
        if model_id:
            m_lower = model_id.lower()
            if "flood" in m_lower:
                if (
                    self.flood_spatial_knowledge_root
                    and self.flood_spatial_knowledge_root.exists()
                ):
                    return self.flood_spatial_knowledge_root
                if self.spatial_knowledge_root and self.spatial_knowledge_root.exists():
                    return self.spatial_knowledge_root
                raise FileNotFoundError(
                    f"No valid package root found for model '{model_id}'. "
                    "Configure FLOOD_SPATIAL_KNOWLEDGE_ROOT or SPATIAL_KNOWLEDGE_ROOT."
                )

            if "landslide" in m_lower:
                if (
                    self.landslide_spatial_knowledge_root
                    and self.landslide_spatial_knowledge_root.exists()
                ):
                    return self.landslide_spatial_knowledge_root
                if self.spatial_knowledge_root and self.spatial_knowledge_root.exists():
                    return self.spatial_knowledge_root
                raise FileNotFoundError(
                    f"No valid package root found for model '{model_id}'. "
                    "Configure LANDSLIDE_SPATIAL_KNOWLEDGE_ROOT or SPATIAL_KNOWLEDGE_ROOT."
                )

            # Check custom model env var: e.g. DROUGHT_SPATIAL_KNOWLEDGE_ROOT
            custom_env_key = f"{model_id.upper()}_SPATIAL_KNOWLEDGE_ROOT"
            custom_env_val = os.getenv(custom_env_key)
            if custom_env_val:
                p = _clean_path(custom_env_val, _backend_dir.parent)
                if p and p.exists():
                    return p

            raise FileNotFoundError(
                f"Model '{model_id}' is not recognized and has no configured package root. "
                f"Configure {custom_env_key} or SPATIAL_KNOWLEDGE_ROOT."
            )

        # Default resolution
        if self.spatial_knowledge_root and self.spatial_knowledge_root.exists():
            return self.spatial_knowledge_root

        # If primary root not set, try model-specific roots if available
        if (
            self.landslide_spatial_knowledge_root
            and self.landslide_spatial_knowledge_root.exists()
        ):
            return self.landslide_spatial_knowledge_root
        if (
            self.flood_spatial_knowledge_root
            and self.flood_spatial_knowledge_root.exists()
        ):
            return self.flood_spatial_knowledge_root

        raise FileNotFoundError(
            "Spatial Knowledge Package not found. Configure SPATIAL_KNOWLEDGE_ROOT "
            "or model-specific environment variables."
        )

    def all_configured_roots(self) -> list[Path]:
        """Return all distinct existing package roots configured in the environment."""
        roots: list[Path] = []
        for candidate in [
            self.spatial_knowledge_root,
            self.flood_spatial_knowledge_root,
            self.landslide_spatial_knowledge_root,
        ]:
            if candidate and candidate.exists() and candidate not in roots:
                roots.append(candidate)
        return roots

    def validate(self) -> dict[str, Any]:
        """
        Validate package configuration state without leaking server filesystem paths.
        Returns a dictionary of health flags and model availability.
        """
        primary_valid = bool(
            self.spatial_knowledge_root
            and self.spatial_knowledge_root.exists()
            and (self.spatial_knowledge_root / "manifest.json").exists()
        )
        flood_valid = bool(
            self.flood_spatial_knowledge_root
            and self.flood_spatial_knowledge_root.exists()
            and (self.flood_spatial_knowledge_root / "manifest.json").exists()
        )
        landslide_valid = bool(
            self.landslide_spatial_knowledge_root
            and self.landslide_spatial_knowledge_root.exists()
            and (self.landslide_spatial_knowledge_root / "manifest.json").exists()
        )

        has_any_package = primary_valid or flood_valid or landslide_valid

        return {
            "environment": self.environment,
            "status": "valid" if has_any_package else "missing_or_invalid",
            "primary_configured": self._raw_root is not None,
            "primary_valid": primary_valid,
            "flood_configured": self._raw_flood_root is not None,
            "flood_valid": flood_valid,
            "landslide_configured": self._raw_landslide_root is not None,
            "landslide_valid": landslide_valid,
            "packages_found": len(self.all_configured_roots()),
            "ollama_configured": bool(self.ollama_base_url and self.ollama_model),
            "ollama_model": self.ollama_model,
        }


# Global singleton instance
settings = SpatialKnowledgeSettings()
