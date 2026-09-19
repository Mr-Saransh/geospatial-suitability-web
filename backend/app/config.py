"""Backend configuration via environment variables."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


class Settings:
    """Application settings read from environment / .env file."""

    def __init__(self) -> None:
        raw = os.getenv(
            "SPATIAL_KNOWLEDGE_ROOT",
            "../outputs/Himachal_Pradesh_Spatial_Knowledge.gdb",
        )
        # Resolve relative to the backend/ directory
        base = Path(__file__).resolve().parent.parent
        self.spatial_knowledge_root: Path = (base / raw).resolve()

    def validate(self) -> None:
        """Raise if the package path is missing."""
        if not self.spatial_knowledge_root.exists():
            raise FileNotFoundError(
                f"Spatial Knowledge Package not found at: {self.spatial_knowledge_root}"
            )
        manifest = self.spatial_knowledge_root / "manifest.json"
        if not manifest.exists():
            raise FileNotFoundError(
                f"manifest.json not found inside: {self.spatial_knowledge_root}"
            )


settings = Settings()
