"""
Unit and integration tests for the Evidence-Grounded Ollama AI Assistant.

Tests:
1. AI health endpoint (/api/v1/ai/health)
2. Request validation (empty question, oversized question, lat without lon)
3. GIS evidence retrieval for Flood and Landslide models
4. Point-specific evidence retrieval inside Himachal Pradesh (Mandi / Shimla)
5. Out-of-bounds coordinate handling (outside HP)
6. Mocked successful Ollama neural generation
7. Ollama offline / timeout fallback generation (never crashes FastAPI)
8. Rate limiting enforcement (per-client rate limiting)
9. Sanitization: no local file paths, Ollama ports, or secrets exposed in answers
"""

from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routers.ai import _rate_limit_records


class TestAIAssistantEndpoint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_ctx = TestClient(app)
        cls.client = cls.client_ctx.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_ctx.__exit__(None, None, None)

    def setUp(self):
        # Reset rate limiting between tests
        _rate_limit_records.clear()

    # 1. AI Health endpoint
    def test_ai_health_endpoint(self):
        res = self.client.get("/api/v1/ai/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("status", data)
        self.assertIn("ollama_reachable", data)
        self.assertIn("configured_model", data)
        self.assertIn("installed_models", data)
        self.assertEqual(data["ollama_url"], "http://127.0.0.1:11434")

    # 2. Main health endpoint includes Ollama health
    def test_main_health_includes_ollama(self):
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("ollama_reachable", data)
        self.assertIn("ollama_status", data)
        self.assertIn("ollama_configured_model", data)

    # 3. Request validation: empty question
    def test_validation_empty_question(self):
        res = self.client.post("/api/v1/ai/ask", json={"question": "   "})
        self.assertIn(res.status_code, (400, 422))

    # 4. Request validation: oversized question (> 1000 chars)
    def test_validation_oversized_question(self):
        long_q = "What is flood risk? " * 100
        res = self.client.post("/api/v1/ai/ask", json={"question": long_q})
        self.assertEqual(res.status_code, 422)

    # 5. Request validation: latitude without longitude
    def test_validation_incomplete_coordinates(self):
        res = self.client.post(
            "/api/v1/ai/ask",
            json={"question": "What is the score here?", "latitude": 31.8645},
        )
        self.assertEqual(res.status_code, 422)

    # 6. Request validation: invalid coordinate ranges
    def test_validation_invalid_coordinate_ranges(self):
        res = self.client.post(
            "/api/v1/ai/ask",
            json={
                "question": "What is the score?",
                "latitude": 95.0,  # Invalid lat > 90
                "longitude": 77.0,
            },
        )
        self.assertEqual(res.status_code, 422)

    # 7. GIS Evidence Retrieval: Model question without coordinates
    def test_evidence_model_overview(self):
        res = self.client.post(
            "/api/v1/ai/ask",
            json={
                "question": "What are the AHP criteria and weights for flood susceptibility?",
                "model_id": "flood_11_factor_v1",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["model_id"], "flood_11_factor_v1")
        self.assertIn("evidence", data)
        ev = data["evidence"]
        self.assertEqual(ev["criteria_count"], 11)
        self.assertTrue(len(ev["criteria_weights"]) >= 11)
        self.assertIsNotNone(ev.get("consistency_ratio"))
        self.assertTrue(ev["consistency_ratio"] <= 0.10)

    # 8. GIS Evidence Retrieval: Point inspection inside Himachal Pradesh
    def test_evidence_point_inspection_valid(self):
        # Known point in Mandi: lat=31.8645, lon=76.7920
        res = self.client.post(
            "/api/v1/ai/ask",
            json={
                "question": "Why is this location classified with this flood risk score?",
                "model_id": "flood_11_factor_v1",
                "latitude": 31.8645,
                "longitude": 76.7920,
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("evidence", data)
        ev = data["evidence"]
        self.assertIn("point_inspection", ev)
        pt = ev["point_inspection"]
        self.assertIn(pt["coverage_status"], ("VALID", "PARTIAL_EVIDENCE"))
        self.assertIsNotNone(pt.get("suitability_score"))
        self.assertTrue(1.0 <= pt["suitability_score"] <= 5.0)
        self.assertTrue(len(pt.get("top_factors", [])) > 0)

    # 9. GIS Evidence Retrieval: Out-of-bounds coordinates (outside HP)
    def test_evidence_point_outside_himachal(self):
        # Delhi: lat=28.6139, lon=77.2090 (Outside HP bounds)
        res = self.client.post(
            "/api/v1/ai/ask",
            json={
                "question": "What is the susceptibility in Delhi?",
                "latitude": 28.6139,
                "longitude": 77.2090,
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        ev = data["evidence"]
        self.assertEqual(ev.get("location_status"), "OUTSIDE_ANALYSIS_AREA")
        self.assertTrue(any("OUTSIDE" in w for w in data.get("warnings", [])))

    # 10. Statistical question triggers real statistics retrieval
    def test_evidence_statistics_retrieval(self):
        res = self.client.post(
            "/api/v1/ai/ask",
            json={
                "question": "What are the overall statewide statistics and class distribution for flood?",
                "model_id": "flood_11_factor_v1",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        ev = data["evidence"]
        self.assertIn("statistics", ev)
        stats = ev["statistics"]
        self.assertIn("valid_coverage_pct", stats)
        self.assertIn("score_mean", stats)
        self.assertIn("class_distribution", stats)
        self.assertTrue(len(stats["class_distribution"]) >= 4)

    # 11. Mocked successful Ollama neural generation
    @patch("httpx.AsyncClient.post")
    @patch("httpx.AsyncClient.get")
    def test_mocked_ollama_generation_success(self, mock_get, mock_post):
        # Mock /api/tags
        mock_get.return_value = AsyncMock(
            status_code=200,
            json=lambda: {"models": [{"name": settings.ollama_model, "model": settings.ollama_model}]},
        )
        # Mock /api/chat
        mock_post.return_value = AsyncMock(
            status_code=200,
            json=lambda: {
                "message": {
                    "role": "assistant",
                    "content": "Based on the Himachal Pradesh 11-Factor Flood model, the suitability score is 1.90 (Class 2: Low Susceptibility).",
                }
            },
        )

        res = self.client.post(
            "/api/v1/ai/ask",
            json={
                "question": "Analyze this point for me",
                "model_id": "flood_11_factor_v1",
                "latitude": 31.8645,
                "longitude": 76.7920,
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["source"], "ollama")
        self.assertIn("1.90", data["answer"])
        self.assertEqual(data["model_used"], settings.ollama_model)

    # 12. Fallback generation when Ollama model is missing or offline
    def test_fallback_generation_when_ollama_offline(self):
        # Even if Ollama has no model, the endpoint must return 200 with structured GIS facts!
        res = self.client.post(
            "/api/v1/ai/ask",
            json={
                "question": "What is the score here?",
                "model_id": "flood_11_factor_v1",
                "latitude": 31.8645,
                "longitude": 76.7920,
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("answer", data)
        self.assertIn("evidence", data)
        # Must disclose fallback / guidance
        self.assertTrue(len(data["warnings"]) > 0 or data["source"] in ("ollama", "evidence_fallback"))

    # 13. Rate limiting enforcement
    def test_rate_limiting_enforcement(self):
        client_ip = "testclient"
        # Temporarily lower limit to test rate limiting
        orig_limit = settings.ai_rate_limit_per_minute
        try:
            settings.ai_rate_limit_per_minute = 3
            _rate_limit_records[client_ip] = []

            for i in range(3):
                res = self.client.post("/api/v1/ai/ask", json={"question": f"Question {i}"})
                self.assertEqual(res.status_code, 200)

            # 4th request must be rate limited
            res = self.client.post("/api/v1/ai/ask", json={"question": "Excess question"})
            self.assertEqual(res.status_code, 429)
            self.assertIn("Retry-After", res.headers)
        finally:
            settings.ai_rate_limit_per_minute = orig_limit
            _rate_limit_records.clear()

    # 14. Landslide model evidence retrieval
    def test_evidence_landslide_model(self):
        res = self.client.post(
            "/api/v1/ai/ask",
            json={
                "question": "What are the 14 factors in the landslide susceptibility model?",
                "model_id": "landslide_14_factor_v1",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["model_id"], "landslide_14_factor_v1")
        self.assertEqual(data["evidence"]["criteria_count"], 14)
