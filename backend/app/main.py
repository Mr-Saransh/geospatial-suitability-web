"""
MCGSE Web-GIS Backend — FastAPI application.

Serves the Himachal Pradesh Spatial Knowledge Package as a REST API
for the React frontend.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.package_service import package_service
from app.routers import health, metadata, models, layers, analyses

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: validate package and load metadata."""
    logger.info("=" * 60)
    logger.info("MCGSE Backend starting")
    logger.info("=" * 60)

    try:
        settings.validate()
        package_service.load()
        logger.info(
            "Package loaded: %s — %s (%d layers)",
            package_service.state_name,
            package_service.model_id,
            len(package_service.layers),
        )
    except FileNotFoundError as e:
        logger.error("PACKAGE ERROR: %s", e)
        logger.error("Backend will start but data endpoints will fail.")

    logger.info("Backend ready — http://127.0.0.1:8000/docs")
    logger.info("=" * 60)

    yield  # app is running

    logger.info("Backend shutting down")


app = FastAPI(
    title="MCGSE Web-GIS API",
    description="Geospatial suitability analysis backend for the Himachal Pradesh Flood Model",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(metadata.router)
app.include_router(models.router)
app.include_router(layers.router)
app.include_router(analyses.router)
