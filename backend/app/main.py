"""
MCGSE Web-GIS Backend — FastAPI application.

Serves the canonical Himachal Pradesh Spatial Knowledge Package(s) as a REST API
for Flood Susceptibility, Landslide Susceptibility, and future MCDA hazards.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ai, analyses, health, layers, metadata, models
from app.services.package_service import package_service
from app.services.repository import repository

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: validate package roots and load metadata."""
    logger.info("=" * 60)
    logger.info("MCGSE Backend starting — Canonical Spatial Knowledge Platform")
    logger.info("Environment: %s", settings.environment)
    logger.info("=" * 60)

    try:
        val = settings.validate()
        logger.info("Package configuration validation: %s", val["status"])
        repository.load()
        package_service.load()

        logger.info(
            "Discovered %d models across %d packages:",
            len(repository.models),
            len(repository.packages),
        )
        for mid, m in repository.models.items():
            layers_count = len(repository.get_layers_for_model(mid))
            logger.info("  ✓ %s: %s (%d layers)", mid, m["name"], layers_count)

    except Exception as e:
        logger.error("PACKAGE INITIALIZATION ERROR: %s", e)
        logger.error("Backend will start in degraded mode.")

    logger.info("Backend ready — http://127.0.0.1:8000/docs")
    logger.info("=" * 60)

    yield  # app is running

    logger.info("Backend shutting down")


app = FastAPI(
    title="MCGSE Web-GIS API",
    description="Unified Geospatial Susceptibility Platform for Himachal Pradesh (Flood, Landslide, MCDA)",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — dynamic configuration from environment
cors_origins = settings.cors_origins
logger.info("Configuring CORS origins: %s", cors_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
app.include_router(ai.router)
