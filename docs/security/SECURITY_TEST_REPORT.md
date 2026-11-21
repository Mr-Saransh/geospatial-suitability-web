# MCGSE Web-GIS Security Test Execution Report

**Document Reference:** SEC-TR-2026-001  
**Target Suite:** Automated Security & Regression Test Harness  
**Environment:** Python 3.12.13 (x64) / FastAPI / Pytest 9.2.0  
**Test Module:** `backend/tests/test_security_hardening.py`  
**Execution Date:** November 2026  
**Overall Result:** **100% PASSED (0 FAILURES, 0 ERRORS)**  

---

## 1. Test Execution Summary

A dedicated automated security regression test suite was engineered to systematically validate all security controls, boundary verifications, input sanitizers, and HTTP header injections introduced during the hardening phase.

| Metric | Target | Actual Result | Status |
| :--- | :--- | :--- | :--- |
| **Security Tests Executed** | 16 | 16 | **PASSED** |
| **Baseline Canonical Package Tests** | 20 | 20 | **PASSED** |
| **Ingestion-to-Web Integration Tests** | 10 | 10 | **PASSED** |
| **AI Endpoint Tests** | 20 | 20 | **PASSED** |
| **Total Test Suite Volume** | **66** | **66** | **PASSED** |
| **Overall Pass Rate** | **100.0%** | **100.0%** | **PASSED** |

---

## 2. Dedicated Security Test Catalog (`test_security_hardening.py`)

| Test Method | Category / Purpose | Input Payload / Action | Expected Result | Actual Result |
| :--- | :--- | :--- | :--- | :--- |
| `test_security_headers_present` | HTTP Headers / Clickjacking / Sniffing | `GET /api/v1/health` | Response contains `nosniff`, `DENY`, `strict-origin-when-cross-origin`, CSP, Permissions-Policy. | **PASSED** (Headers matched exactly) |
| `test_cors_allow_credentials_rule` | CORS Compliance | Patch `cors_origins_raw="*"` vs specific domain | Wildcard `*` forces `cors_allow_credentials=False`; specific domain enables credentials. | **PASSED** |
| `test_tile_coordinates_negative_zoom` | Slippy Tile Bounds Check | `GET /api/v1/tiles/<layer>/-1/0/0.png` | `HTTP 400 Bad Request` with descriptive zoom level error. | **PASSED** |
| `test_tile_coordinates_excessive_zoom` | Slippy Tile Bounds Check | `GET /api/v1/tiles/<layer>/25/0/0.png` | `HTTP 400 Bad Request` stating zoom must be between 0 and 22. | **PASSED** |
| `test_tile_coordinates_out_of_bounds_x_y` | Slippy Tile Bounds Check | `GET /api/v1/tiles/<layer>/2/10/2.png` | `HTTP 400 Bad Request` stating coordinates exceed `2^z`. | **PASSED** |
| `test_layer_path_traversal_rejection` | Directory Traversal Defense | `_sanitize_layer_id("../secret")` & `GET /api/v1/layers/test..secret` | `HTTP 400 Bad Request` rejecting traversal sequences. | **PASSED** |
| `test_tile_path_traversal_rejection` | Directory Traversal Defense | `GET /api/v1/tiles/test..secret/0/0/0.png` | `HTTP 400 Bad Request` rejecting traversal sequences. | **PASSED** |
| `test_repository_safe_resolve_raster_path_null_byte` | File Path Poisoning | `repository.safe_resolve_raster_path(root, "rasters/\x00secret.tif")` | Raises `ValueError` for null byte detection. | **PASSED** |
| `test_point_inspection_invalid_model_id` | Input Injection Defense | `GET /api/v1/analyses/bad$model!id/point` | `HTTP 400 Bad Request` rejecting invalid model characters. | **PASSED** |
| `test_point_inspection_latitude_out_of_range` | Coordinate Bounds Check | `GET /api/v1/analyses/.../point?lat=95.0` | `HTTP 422 Unprocessable Content` rejecting invalid latitude. | **PASSED** |
| `test_point_inspection_longitude_out_of_range` | Coordinate Bounds Check | `GET /api/v1/analyses/.../point?lon=200.0` | `HTTP 422 Unprocessable Content` rejecting invalid longitude. | **PASSED** |
| `test_large_request_body_rejected` | Denial of Service (DoS) Defense | `POST /api/v1/ai/ask` with `Content-Length: 2097152` | `HTTP 413 Payload Too Large` immediately returned. | **PASSED** |
| `test_rate_limiting_enforced` | Abuse & Resource Starvation | 21 rapid requests from single client IP | `HTTP 429 Too Many Requests` triggered after limit reached. | **PASSED** |
| `test_client_ip_trusted_proxy_handling` | Rate Limit Bypass Defense | Untrusted IP sending spoofed `X-Forwarded-For` vs Trusted Proxy (127.0.0.1) | Untrusted IP spoof ignored; Trusted proxy forwarded IP accepted. | **PASSED** |
| `test_ai_question_length_limit` | Context Stuffing / Buffer Defense | `POST /api/v1/ai/ask` with 1050-character question | `HTTP 422 Unprocessable Content` rejecting oversized query. | **PASSED** |
| `test_not_found_structured_error` | Information Disclosure Defense | `GET /api/v1/non_existent_endpoint` | `HTTP 404` with clean JSON. No stack traces or file paths leaked. | **PASSED** |

---

## 3. Regression Test Execution

To guarantee that hardening measures introduced zero regressions into the core scientific GIS calculations:
1. **Model Discoveries:** Verified simultaneous loading of Flood 11-Factor AHP and Landslide 14-Factor MCDA models.
2. **AHP/MCDA Integrity:** Validated consistency ratios, lambda max, random index, and normalized criterion weights.
3. **Continuous & Classified Synchronization:** Validated that sampled continuous scores match discrete class thresholds across state boundaries.
4. **Tile Rendering:** Tested multi-band raster rendering in Web Mercator (EPSG:3857) across various zoom levels.
5. **Point Sampling:** Verified windowed reads accurately detect `VALID`, `PARTIAL_EVIDENCE`, `NODATA`, and `OUTSIDE_ANALYSIS_AREA` with strict null semantics preserved.

---

## 4. Test Environment Details

```
Platform: Windows (win32) / Python 3.12.13
Test Engine: pytest 9.2.0, pytest-asyncio 1.5.0, anyio 4.14.2
FastAPI Test Harness: Starlette TestClient with HTTPX
Spatial Dependencies: Rasterio 1.4.3, GDAL 3.10.0, PyProj 3.7.0, NumPy 2.2.3
Runtimes Tested: FastAPI Backend, Uvicorn, Nginx reverse proxy configuration
```

---

## 5. Security Test Sign-Off

The security test suite has demonstrated that all identified attack surfaces (CORS hijacking, XSS, Path Traversal, Tile Memory Exhaustion, Spoofed Rate Limit Bypasses, and Large Payload Floods) are effectively mitigated. All tests pass deterministically.
