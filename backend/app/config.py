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
        base = Path(__file__).resolve().parent.parent
        raw_path = Path(raw)
        if raw_path.is_absolute():
            self.spatial_knowledge_root: Path = raw_path.resolve()
        else:
            self.spatial_knowledge_root: Path = (base / raw).resolve()

    def validate(self) -> None:
        """Raise if the package path is missing or invalid."""
        if not self.spatial_knowledge_root.exists():
            raise FileNotFoundError(
                "Spatial Knowledge Package not found at configured SPATIAL_KNOWLEDGE_ROOT."
            )
        manifest = self.spatial_knowledge_root / "manifest.json"
        if not manifest.exists():
            raise FileNotFoundError(
                "manifest.json not found inside configured SPATIAL_KNOWLEDGE_ROOT."
            )


settings = Settings()
