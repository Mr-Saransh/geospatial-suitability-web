"""
AI Assistant Router V2 — Versioned endpoints for evidence-grounded Ollama intelligence.

Exposes:
- POST /api/v1/ai/ask: Non-streaming request (backward compatible)
- POST /api/v1/ai/ask/stream: Real-time event-driven streaming with progress states & token stream
- GET  /api/v1/ai/health: Ollama connection status, configured model, and setup instructions
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.schemas import AIAssistantRequest, AIAssistantResponse, AIHealthResponse
from app.services.ai_evidence import retrieve_gis_evidence
from app.services.ollama_service import ollama_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["ai"])

# ── In-Memory Rate Limiter ──────────────────────────────────
_rate_limit_records: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_ip: str) -> None:
    now = time.time()
    window = 60.0
    limit = settings.ai_rate_limit_per_minute

    timestamps = _rate_limit_records[client_ip]
    valid_timestamps = [t for t in timestamps if now - t < window]
    _rate_limit_records[client_ip] = valid_timestamps

    if len(valid_timestamps) >= limit:
        logger.warning(
            "Rate limit exceeded for IP: %s (%d requests in 60s)",
            client_ip,
            len(valid_timestamps),
        )
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
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


def _format_sse(event_type: str, data: dict[str, Any]) -> str:
    """Format dictionary payload as SSE event."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


# ── AI Health Endpoint ──────────────────────────────────────
@router.get("/ai/health", response_model=AIHealthResponse)
async def get_ai_health():
    """
    Check local Ollama reachability, installed models, and readiness.
    Does not leak host filesystem paths or secrets.
    """
    health = await ollama_service.get_health()
    return AIHealthResponse(**health)


# ── AI Query Endpoint (Non-streaming) ───────────────────────
@router.post("/ai/ask", response_model=AIAssistantResponse)
async def ask_ai(req: AIAssistantRequest, request: Request):
    """
    Geospatial AI Assistant endpoint (non-streaming):
    1. Validates input & applies client rate limiting.
    2. Retrieves real GIS evidence from local Spatial Knowledge Packages.
    3. Invokes local Ollama LLM grounded strictly on retrieved facts.
    4. Returns evidence-grounded answer, structured facts, coverage, and disclosures.
    """
    client_ip = _get_client_ip(request)
    _check_rate_limit(client_ip)

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

    if (req.latitude is not None and req.longitude is None) or (
        req.latitude is None and req.longitude is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both latitude and longitude must be provided together for point analysis.",
        )

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

    history_items: list[dict[str, str]] = []
    if req.history:
        for h in req.history:
            history_items.append({"role": h.role, "content": h.content})

    try:
        generation = await ollama_service.generate_grounded_answer(
            question=cleaned_question,
            evidence_result=evidence_result,
            history=history_items,
        )
    except Exception as e:
        logger.error("Unexpected error during AI generation: %s", e)
        generation = {
            "answer": "An unexpected error occurred during neural generation. Real GIS evidence is provided below.",
            "model_used": "evidence_summary",
            "source": "evidence_fallback",
            "warning": "Neural generation failed. Presenting raw GIS package facts.",
        }

    all_warnings = list(evidence_result.get("warnings", []))
    gen_warn = generation.get("warning")
    if gen_warn and gen_warn not in all_warnings:
        all_warnings.append(gen_warn)

    return AIAssistantResponse(
        answer=generation["answer"],
        model_id=evidence_result["model_id"],
        evidence=evidence_result["evidence"],
        items=evidence_result.get("items", []),
        coverage=evidence_result.get("coverage"),
        warnings=all_warnings,
        model_used=generation.get("model_used"),
        source=generation.get("source", "ollama"),
    )


# ── AI Query Endpoint (Live Streaming SSE) ───────────────────
@router.post("/ai/ask/stream")
async def ask_ai_stream(req: AIAssistantRequest, request: Request):
    """
    Live streaming endpoint (SSE):
    Emits real event-driven progress states:
    1. status: understanding_question
    2. status: identifying_model
    3. status: retrieving_metadata
    4. status: inspecting_raster (when coordinates supplied)
    5. status: collecting_statistics (when statistics query)
    6. status: preparing_evidence
    7. evidence: structured facts and atomic items
    8. status: generating_answer
    9. token: streamed answer fragments
    10. done: final response and metadata
    """
    client_ip = _get_client_ip(request)
    _check_rate_limit(client_ip)

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

    if (req.latitude is not None and req.longitude is None) or (
        req.latitude is None and req.longitude is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both latitude and longitude must be provided together for point analysis.",
        )

    history_items: list[dict[str, str]] = []
    if req.history:
        for h in req.history:
            history_items.append({"role": h.role, "content": h.content})

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # 1. Understanding question
            yield _format_sse(
                "status",
                {
                    "type": "status",
                    "stage": "understanding_question",
                    "message": "Understanding your question and spatial context...",
                },
            )
            await asyncio.sleep(0.01)

            # 2. Identifying model
            yield _format_sse(
                "status",
                {
                    "type": "status",
                    "stage": "identifying_model",
                    "message": f"Identifying spatial model for: {cleaned_question[:60]}...",
                    "model_id": req.model_id,
                },
            )

            # 3. Retrieving metadata
            yield _format_sse(
                "status",
                {
                    "type": "status",
                    "stage": "retrieving_metadata",
                    "message": "Retrieving model criteria, weights, and classification thresholds...",
                },
            )

            # 4. If coordinates supplied, inspecting raster evidence
            if req.latitude is not None and req.longitude is not None:
                yield _format_sse(
                    "status",
                    {
                        "type": "status",
                        "stage": "inspecting_raster",
                        "message": f"Inspecting raster values at ({req.latitude:.4f}°N, {req.longitude:.4f}°E)...",
                    },
                )

            # 5. If statistical query, collecting statistics
            is_stats = any(
                k in cleaned_question.lower()
                for k in (
                    "stat",
                    "mean",
                    "coverage",
                    "percent",
                    "area",
                    "distribution",
                    "statewide",
                )
            )
            if is_stats:
                yield _format_sse(
                    "status",
                    {
                        "type": "status",
                        "stage": "collecting_statistics",
                        "message": "Collecting statewide coverage and distribution statistics...",
                    },
                )

            # Perform actual GIS evidence retrieval
            evidence_result = retrieve_gis_evidence(
                question=cleaned_question,
                model_id=req.model_id,
                latitude=req.latitude,
                longitude=req.longitude,
            )

            # 6. Preparing evidence
            yield _format_sse(
                "status",
                {
                    "type": "status",
                    "stage": "preparing_evidence",
                    "message": "Preparing verified GIS facts for MCGSE AI...",
                },
            )

            # 7. Emit verified evidence event to frontend
            yield _format_sse(
                "evidence",
                {
                    "type": "evidence",
                    "model_id": evidence_result["model_id"],
                    "evidence": evidence_result["evidence"],
                    "items": evidence_result.get("items", []),
                    "coverage": evidence_result.get("coverage"),
                    "warnings": evidence_result.get("warnings", []),
                },
            )

            # 8. Generating answer locally
            yield _format_sse(
                "status",
                {
                    "type": "status",
                    "stage": "generating_answer",
                    "message": "Generating answer locally via Ollama...",
                },
            )

            # 9. Stream progressive tokens from Ollama
            full_answer_parts: list[str] = []
            last_done: dict[str, Any] | None = None

            async for chunk in ollama_service.stream_grounded_answer(
                question=cleaned_question,
                evidence_result=evidence_result,
                history=history_items,
                is_disconnected=request.is_disconnected,
            ):
                if chunk["type"] == "token":
                    full_answer_parts.append(chunk["text"])
                    yield _format_sse(
                        "token",
                        {"type": "token", "text": chunk["text"]},
                    )
                elif chunk["type"] == "done":
                    last_done = chunk

            # 10. Emit final done event
            accumulated_answer = "".join(full_answer_parts).strip()
            final_answer = (
                last_done.get("answer") if last_done else accumulated_answer
            ) or accumulated_answer

            all_warnings = list(evidence_result.get("warnings", []))
            if last_done and last_done.get("warning"):
                if last_done["warning"] not in all_warnings:
                    all_warnings.append(last_done["warning"])

            done_payload = {
                "type": "done",
                "answer": final_answer,
                "model_id": evidence_result["model_id"],
                "evidence": evidence_result["evidence"],
                "items": evidence_result.get("items", []),
                "coverage": evidence_result.get("coverage"),
                "warnings": all_warnings,
                "model_used": last_done.get("model_used")
                if last_done
                else None,
                "source": last_done.get("source", "ollama")
                if last_done
                else "ollama",
            }
            yield _format_sse("done", done_payload)

        except Exception as e:
            logger.error("Error in AI streaming generation: %s", e)
            yield _format_sse(
                "error",
                {
                    "type": "error",
                    "detail": "An error occurred during AI processing.",
                },
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
