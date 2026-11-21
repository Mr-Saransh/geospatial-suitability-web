"""
MCGSE Web-GIS Backend — FastAPI application.

Serves the canonical Himachal Pradesh Spatial Knowledge Package(s) as a REST API
for Flood Susceptibility, Landslide Susceptibility, and future MCDA hazards.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

    docs_enabled = (
        settings.environment != "production" or settings.enable_docs_in_production
    )
    if docs_enabled:
        logger.info("Backend ready — http://127.0.0.1:8000/docs")
    else:
        logger.info("Backend ready (API docs disabled in production mode)")
    logger.info("=" * 60)

    yield  # app is running

    logger.info("Backend shutting down")


docs_enabled = (
    settings.environment != "production" or settings.enable_docs_in_production
)

app = FastAPI(
    title="MCGSE Web-GIS API",
    description="Unified Geospatial Susceptibility Platform for Himachal Pradesh (Flood, Landslide, MCDA)",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
)

# 1. Global Structured Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Prevent internal stack traces, file paths, or sensitive details
    from leaking to clients upon unhandled exceptions.
    """
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )
    logger.exception("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": "An internal error occurred while processing your request. Please contact system administrator.",
        },
    )


# 2. Request Body Size Limiter Middleware
@app.middleware("http")
async def limit_request_body_size(request: Request, call_next):
    """Reject requests with payloads exceeding maximum permitted size (DoS prevention)."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            length = int(content_length)
            if length > settings.max_request_body_size:
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": "Payload Too Large",
                        "detail": f"Request body exceeds maximum allowed size of {settings.max_request_body_size} bytes.",
                    },
                )
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"error": "Bad Request", "detail": "Invalid Content-Length header."},
            )
    return await call_next(request)


# 3. Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Enforce defense-in-depth HTTP security headers."""
    response = await call_next(request)
    if settings.enable_security_headers:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(self)"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: blob: https://server.arcgisonline.com https://*.tile.opentopomap.org https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; "
            "connect-src 'self' https: http:; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' data:; "
            "frame-ancestors 'none';"
        )
        if settings.environment == "production" or request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
    return response


# 4. CORS — Dynamic configuration from environment with credential safety
cors_origins = settings.cors_origins
allow_credentials = settings.cors_allow_credentials
logger.info(
    "Configuring CORS: origins=%s, allow_credentials=%s",
    cors_origins,
    allow_credentials,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(metadata.router)
app.include_router(models.router)
app.include_router(layers.router)
app.include_router(analyses.router)
app.include_router(ai.router)
