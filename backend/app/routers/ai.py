"""
AI Assistant Router — Versioned endpoint for evidence-grounded Ollama intelligence.

Exposes:
- POST /api/v1/ai/ask: Answer questions using genuine GIS evidence and local Ollama
- GET  /api/v1/ai/health: Ollama connection status, configured model, and setup instructions
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from app.config import settings
from app.schemas import AIAssistantRequest, AIAssistantResponse, AIHealthResponse
from app.services.ai_evidence import retrieve_gis_evidence
from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["ai"])

# ── In-Memory Rate Limiter ──────────────────────────────────
# Tracks timestamps of recent requests per client IP within a sliding 60-second window.
# Note: In-memory rate limiting is process-local and resets upon server restart.
_rate_limit_records: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_ip: str) -> None:
    now = time.time()
    window = 60.0
    limit = settings.ai_rate_limit_per_minute

    timestamps = _rate_limit_records[client_ip]
    # Prune timestamps older than 60 seconds
    valid_timestamps = [t for t in timestamps if now - t < window]
    _rate_limit_records[client_ip] = valid_timestamps

    if len(valid_timestamps) >= limit:
        logger.warning("Rate limit exceeded for IP: %s (%d requests in 60s)", client_ip, len(valid_timestamps))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: maximum {limit} AI requests per minute. Please try again shortly.",
            headers={"Retry-After": "30"},
        )

    _rate_limit_records[client_ip].append(now)


def _get_client_ip(request: Request) -> str:
    """Extract client IP handling proxy headers securely."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the leftmost untrusted client IP
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


# ── AI Health Endpoint ──────────────────────────────────────
@router.get("/ai/health", response_model=AIHealthResponse)
async def get_ai_health():
    """
    Check local Ollama reachability, installed models, and readiness.
    Does not leak host filesystem paths or secrets.
    """
    health = await ollama_service.get_health()
    return AIHealthResponse(**health)


# ── AI Query Endpoint ───────────────────────────────────────
@router.post("/ai/ask", response_model=AIAssistantResponse)
async def ask_ai(req: AIAssistantRequest, request: Request):
    """
    Geospatial AI Assistant endpoint:
    1. Validates input & applies client rate limiting.
    2. Retrieves real GIS evidence from local Spatial Knowledge Packages.
    3. Invokes local Ollama LLM grounded strictly on retrieved facts.
    4. Returns evidence-grounded answer, structured facts, coverage, and disclosures.
    """
    # 1. Enforce rate limiting
    client_ip = _get_client_ip(request)
    _check_rate_limit(client_ip)

    # 2. Validate question
    cleaned_question = req.question.strip()
    if not cleaned_question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question must not be empty.",
        )
    if len(cleaned_question) > settings.ai_max_question_length:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Question exceeds maximum permitted length of {settings.ai_max_question_length} characters.",
        )

    # Validate coordinate pairing
    if (req.latitude is not None and req.longitude is None) or (
        req.latitude is None and req.longitude is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both latitude and longitude must be provided together for point analysis.",
        )

    # 3. Retrieve genuine GIS evidence from backend
    try:
        evidence_result = retrieve_gis_evidence(
            question=cleaned_question,
            model_id=req.model_id,
            latitude=req.latitude,
            longitude=req.longitude,
        )
    except Exception as e:
        logger.error("Failed to retrieve GIS evidence: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve GIS package evidence.",
        )

    # Convert history into dict format for service
    history_items: list[dict[str, str]] = []
    if req.history:
        for h in req.history:
            history_items.append({"role": h.role, "content": h.content})

    # 4. Generate grounded answer via local Ollama
    try:
        generation = await ollama_service.generate_grounded_answer(
            question=cleaned_question,
            evidence_result=evidence_result,
            history=history_items,
        )
    except Exception as e:
        logger.error("Unexpected error during AI generation: %s", e)
        # Even on unexpected error, do NOT crash FastAPI — return evidence report fallback
        generation = {
            "answer": "An unexpected error occurred during neural generation. Real GIS evidence is provided below.",
            "model_used": "evidence_summary",
            "source": "evidence_fallback",
            "warning": "Neural generation failed. Presenting raw GIS package facts.",
        }

    # Aggregate warnings
    all_warnings = list(evidence_result.get("warnings", []))
    gen_warn = generation.get("warning")
    if gen_warn and gen_warn not in all_warnings:
        all_warnings.append(gen_warn)

    return AIAssistantResponse(
        answer=generation["answer"],
        model_id=evidence_result["model_id"],
        evidence=evidence_result["evidence"],
        coverage=evidence_result.get("coverage"),
        warnings=all_warnings,
        model_used=generation.get("model_used"),
        source=generation.get("source", "ollama"),
    )
