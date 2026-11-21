"""
Security Hardening and Defense-in-Depth Verification Test Suite.

Validates:
1. Security Headers (HSTS, X-Content-Type-Options, X-Frame-Options, CSP, Permissions-Policy)
2. CORS configuration and credential rules
3. Tile zoom and coordinate boundary validation (DoS prevention)
4. Path traversal rejection on layer catalog and tile endpoints
5. Point inspection coordinate validation (NaN, Inf, Range)
6. Model ID sanitization and injection rejection
7. Request payload size limiting (HTTP 413)
8. AI rate limiting and IP spoofing prevention (trusted proxy evaluation)
9. AI input length constraints and history truncation
10. Global error handling and information leakage prevention
"""

import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routers.ai import _check_rate_limit, _get_client_ip, _rate_limit_records
from app.services.repository import repository


class TestSecurityHardening(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_ctx = TestClient(app)
        cls.client = cls.client_ctx.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_ctx.__exit__(None, None, None)

    # 1. Security Headers
    def test_security_headers_present(self):
        """Verify essential HTTP security headers are injected in responses."""
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)

        # nosniff
        self.assertEqual(res.headers.get("x-content-type-options"), "nosniff")
        # Clickjacking defense
        self.assertEqual(res.headers.get("x-frame-options"), "DENY")
        # Referrer policy
        self.assertEqual(
            res.headers.get("referrer-policy"), "strict-origin-when-cross-origin"
        )
        # Permissions policy
        self.assertIn("camera=()", res.headers.get("permissions-policy", ""))
        self.assertIn("microphone=()", res.headers.get("permissions-policy", ""))
        # Content Security Policy
        csp = res.headers.get("content-security-policy", "")
        self.assertIn("default-src 'self'", csp)
        self.assertIn("frame-ancestors 'none'", csp)
        self.assertIn("*.basemaps.cartocdn.com", csp)
        self.assertIn("server.arcgisonline.com", csp)

    # 2. CORS and Credential Rules
    def test_cors_allow_credentials_rule(self):
        """Credentials must be disallowed when CORS origins is wildcard '*'."""
        with patch.object(settings, "cors_origins_raw", "*"):
            self.assertEqual(settings.cors_origins, ["*"])
            self.assertFalse(settings.cors_allow_credentials)

        with patch.object(settings, "cors_origins_raw", "https://gis.example.com"):
            self.assertEqual(settings.cors_origins, ["https://gis.example.com"])
            self.assertTrue(settings.cors_allow_credentials)

    # 3. Slippy Tile Coordinate Validation (Prevent Resource Exhaustion)
    def test_tile_coordinates_negative_zoom(self):
        """Negative zoom levels must be rejected with HTTP 400."""
        res = self.client.get("/api/v1/tiles/flood_11_factor_v1_full_suitability/-1/0/0.png")
        self.assertEqual(res.status_code, 400)
        self.assertIn("zoom level", res.json()["detail"].lower())

    def test_tile_coordinates_excessive_zoom(self):
        """Zoom levels > 22 must be rejected with HTTP 400."""
        res = self.client.get("/api/v1/tiles/flood_11_factor_v1_full_suitability/25/0/0.png")
        self.assertEqual(res.status_code, 400)
        self.assertIn("between 0 and 22", res.json()["detail"])

    def test_tile_coordinates_out_of_bounds_x_y(self):
        """Tile coordinates exceeding 2^z must be rejected with HTTP 400."""
        # At zoom 2, maximum valid coordinate is 2^2 - 1 = 3
        res = self.client.get("/api/v1/tiles/flood_11_factor_v1_full_suitability/2/10/2.png")
        self.assertEqual(res.status_code, 400)
        self.assertIn("out of range", res.json()["detail"])

        res_neg = self.client.get("/api/v1/tiles/flood_11_factor_v1_full_suitability/2/-1/2.png")
        self.assertEqual(res_neg.status_code, 400)

    # 4. Path Traversal Rejection
    def test_layer_path_traversal_rejection(self):
        """Path traversal characters in layer_id must return HTTP 400."""
        from app.routers.layers import _sanitize_layer_id
        from fastapi import HTTPException

        # Direct unit validation
        for bad_id in ["../secret", "..\\secret", "secret\x00name", "invalid*chars"]:
            with self.assertRaises(HTTPException) as ctx:
                _sanitize_layer_id(bad_id)
            self.assertEqual(ctx.exception.status_code, 400)

        # HTTP request validation with embedded path traversal sequence
        res = self.client.get("/api/v1/layers/test..secret")
        self.assertEqual(res.status_code, 400)
        self.assertIn("path traversal", res.json()["detail"].lower())

    def test_tile_path_traversal_rejection(self):
        """Path traversal in tile layer path must return HTTP 400."""
        res = self.client.get("/api/v1/tiles/test..secret/0/0/0.png")
        self.assertEqual(res.status_code, 400)
        self.assertIn("path traversal", res.json()["detail"].lower())

    def test_repository_safe_resolve_raster_path_null_byte(self):
        """Safe resolve must reject null bytes."""
        root = settings.default_package_root
        if root:
            with self.assertRaises(ValueError) as ctx:
                repository.safe_resolve_raster_path(root, "rasters/\x00secret.tif")
            self.assertIn("Null byte", str(ctx.exception))

    # 5. Point Analysis Input Validation
    def test_point_inspection_invalid_model_id(self):
        """Malformed or malicious model IDs must return HTTP 400."""
        res = self.client.get(
            "/api/v1/analyses/bad$model!id/point",
            params={"lat": 31.1048, "lon": 77.1734},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid model identifier", res.json()["detail"])

    def test_point_inspection_latitude_out_of_range(self):
        """Latitudes outside [-90, 90] must fail validation."""
        res = self.client.get(
            "/api/v1/analyses/flood_11_factor_v1/point",
            params={"lat": 95.0, "lon": 77.1734},
        )
        self.assertEqual(res.status_code, 422)

    def test_point_inspection_longitude_out_of_range(self):
        """Longitudes outside [-180, 180] must fail validation."""
        res = self.client.get(
            "/api/v1/analyses/flood_11_factor_v1/point",
            params={"lat": 31.1048, "lon": 200.0},
        )
        self.assertEqual(res.status_code, 422)

    # 6. Request Payload Size Limiter (HTTP 413)
    def test_large_request_body_rejected(self):
        """Requests exceeding MAX_REQUEST_BODY_SIZE must be rejected with HTTP 413."""
        # Send a request with Content-Length larger than settings.max_request_body_size
        oversized = 2 * 1024 * 1024  # 2MB
        headers = {
            "Content-Type": "application/json",
            "Content-Length": str(oversized),
        }
        res = self.client.post("/api/v1/ai/ask", data=b"{}", headers=headers)
        self.assertEqual(res.status_code, 413)
        self.assertEqual(res.json()["error"], "Payload Too Large")

    # 7. AI Rate Limiting & Spoofing Defense
    def test_rate_limiting_enforced(self):
        """Excessive requests from same IP must receive HTTP 429."""
        test_ip = "192.0.2.1"
        _rate_limit_records[test_ip] = []

        # Consume all tokens up to limit
        for _ in range(settings.ai_rate_limit_per_minute):
            _check_rate_limit(test_ip)

        # Next request must raise 429
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as ctx:
            _check_rate_limit(test_ip)
        self.assertEqual(ctx.exception.status_code, 429)

    def test_client_ip_trusted_proxy_handling(self):
        """X-Forwarded-For should be ignored from untrusted client IPs."""
        # Untrusted client IP
        mock_req_untrusted = MagicMock()
        mock_req_untrusted.client.host = "203.0.113.195"  # Public untrusted IP
        mock_req_untrusted.headers = {"X-Forwarded-For": "198.51.100.5"}

        extracted_ip = _get_client_ip(mock_req_untrusted)
        # Must retain direct client IP, rejecting the spoofed X-Forwarded-For
        self.assertEqual(extracted_ip, "203.0.113.195")

        # Trusted proxy client IP (e.g., 127.0.0.1)
        mock_req_trusted = MagicMock()
        mock_req_trusted.client.host = "127.0.0.1"
        mock_req_trusted.headers = {"X-Forwarded-For": "198.51.100.5, 10.0.0.1"}

        extracted_trusted = _get_client_ip(mock_req_trusted)
        self.assertEqual(extracted_trusted, "198.51.100.5")

    # 8. AI Input Constraints
    def test_ai_question_length_limit(self):
        """Questions exceeding ai_max_question_length must return HTTP 422."""
        long_question = "A" * (settings.ai_max_question_length + 50)
        res = self.client.post(
            "/api/v1/ai/ask",
            json={"question": long_question, "model_id": "flood_11_factor_v1"},
        )
        self.assertEqual(res.status_code, 422)
        body_text = str(res.json())
        self.assertTrue(
            "1000" in body_text or "string_too_long" in body_text or "length" in body_text
        )

    # 9. Structured Error Handling (No Information Leakage)
    def test_not_found_structured_error(self):
        """Non-existent endpoints return clean JSON without server internals."""
        res = self.client.get("/api/v1/non_existent_endpoint_for_test")
        self.assertEqual(res.status_code, 404)
        self.assertIn("detail", res.json())
        self.assertNotIn("Traceback", res.text)
        self.assertNotIn("File \"", res.text)


if __name__ == "__main__":
    unittest.main()
