# MCGSE Web-GIS Security Hardening Changelog

**Release:** Production Hardening v2.1.0-sec  
**Date:** November 2026  
**Auditor / Engineer:** Product Security Architecture  

---

## Overview of Changes

This changelog records all code, configuration, container, and infrastructure modifications made during the security audit and hardening process of the MCGSE Web-GIS platform. All modifications adhere to the zero-breakage constraint for GIS analytical processing.

---

## 1. Backend Application Layer

### `backend/app/config.py`
- **Added Security Settings:**
  - `trusted_proxies_raw`: Comma-separated list of trusted proxy CIDRs/IPs (defaults to `127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`).
  - `max_request_body_size`: Maximum allowed HTTP request body size in bytes (defaults to `1048576` = 1MB).
  - `enable_security_headers`: Boolean flag to toggle defense-in-depth security response headers (defaults to `True`).
  - `enable_docs_in_production`: Boolean flag controlling OpenAPI / Swagger UI visibility in production (defaults to `False`).
- **Added Property `cors_allow_credentials`:**
  - Evaluates to `False` if `cors_origins == ["*"]` (preventing RFC-violating and insecure wildcard credential headers). Evaluates to `True` when explicit domains are specified.
- **Added Property `trusted_proxies`:**
  - Returns a cleaned list of trusted proxy IP/subnet strings for proxy-header validation.

### `backend/app/main.py`
- **Production API Documentation Shielding:**
  - Conditionally configures `docs_url`, `redoc_url`, and `openapi_url` to `None` when `ENVIRONMENT == "production"` unless `ENABLE_DOCS_IN_PRODUCTION=true`.
- **Global Structured Exception Handler:**
  - Added `@app.exception_handler(Exception)` intercepting unhandled errors and returning standardized JSON (`{"error": "Internal Server Error", "detail": "..."}`) without leaking internal Python tracebacks, module paths, or server system details.
- **Request Body Size Limiter Middleware:**
  - Checks incoming `Content-Length` header; returns `HTTP 413 Payload Too Large` if exceeding `settings.max_request_body_size`. Returns `HTTP 400 Bad Request` on malformed length headers.
- **Security Headers Middleware:**
  - Injects `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
  - Injects comprehensive `Content-Security-Policy` permitting tile basemaps (CartoDB, OpenStreetMap, OpenTopoMap, Esri ArcGIS Online) and SSE connections.
  - Automatically injects `Strict-Transport-Security` when running in production or over HTTPS.
- **CORS Hardening:**
  - Dynamically binds `allow_credentials=settings.cors_allow_credentials` to prevent invalid wildcard origin credential reflection. Restricts allowed methods to `GET, POST, OPTIONS`.

### `backend/app/routers/layers.py`
- **Identifier Validation & Path Traversal Prevention:**
  - Added regex `_LAYER_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_.:/-]+$")` and `_sanitize_layer_id()`.
  - Enforces 128 character max length and rejects null bytes, backslashes, and `..` traversal sequences with `HTTP 400 Bad Request`.
- **Slippy Tile Coordinate Boundaries:**
  - Validates zoom level `0 <= z <= 22`.
  - Computes `max_coord = 1 << z` and validates `0 <= x < max_coord` and `0 <= y < max_coord`. Rejects invalid tile coordinates with `HTTP 400 Bad Request`.
- **Removed Hardcoded Header:**
  - Removed line `"Access-Control-Allow-Origin": "*"` from tile responses, ensuring centralized CORS middleware manages headers consistently.

### `backend/app/routers/analyses.py`
- **Coordinate Validation:**
  - Added finite numeric validation for `lat` and `lon` using `math.isnan()` and `math.isinf()` with `HTTP 400` rejection.
- **Model Identifier Sanitization:**
  - Added `_validate_model_id()` enforcing regex `^[a-zA-Z0-9_-]+$` and 64 character max length.

### `backend/app/routers/ai.py`
- **Trusted Proxy IP Extraction:**
  - Implemented `_is_ip_in_network_or_match()` and `_is_trusted_proxy()`.
  - `_get_client_ip()` only evaluates `X-Forwarded-For` if the immediate peer IP matches `settings.trusted_proxies`. Prevents IP spoofing to bypass the in-memory rate limiter.
- **History Capping:**
  - Enforced `req.history[-settings.ai_max_history:]` truncation and question length capping on conversation context items.

### `backend/app/services/repository.py`
- **Path Resolution Hardening:**
  - Added null byte check `\x00` in `safe_resolve_raster_path()` prior to path manipulation.

---

## 2. Frontend Application Layer

### `src/components/AIPanel.tsx`
- **XSS Mitigation in Markdown Formatter:**
  - Added `escapeHtml()` utility escaping `&`, `<`, `>`, `"`, and `'`.
  - Applied `escapeHtml()` at the entry of `formatMarkdown()` before regex transformations, preventing script execution via LLM text or error message reflection in `dangerouslySetInnerHTML`.

### `src/lib/api/client.ts`
- **URL Scheme Validation:**
  - Added `isValidApiUrl()` checking that runtime URL overrides use `http:` or `https:` protocols, or are root-relative (`/`).
  - Neutralized malicious query parameter API URL redirection (e.g. `?api=javascript:...`).

---

## 3. Container & Infrastructure Layer

### `nginx.conf`
- **Information Disclosure Prevention:**
  - Added `server_tokens off;` to suppress Nginx version numbers in HTTP responses.
- **Security Headers & Limits:**
  - Configured `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Content-Security-Policy`.
  - Set `client_max_body_size 2M;`, `client_body_timeout 15s;`, and `client_header_timeout 15s;`.

### `docker-compose.yml`
- **Ollama Loopback Binding:**
  - Changed `ports: - "11434:11434"` to `ports: - "127.0.0.1:11434:11434"`, preventing direct external access to the Ollama API from public interfaces.

### `aws/ecs-task-definition.json`
- **CORS & Environment Hardening:**
  - Replaced `CORS_ORIGINS=*` with `https://gis.example.com`.
  - Added production security environment variables: `ENABLE_SECURITY_HEADERS=true`, `ENABLE_DOCS_IN_PRODUCTION=false`, `MAX_REQUEST_BODY_SIZE=1048576`.

### `backend/.env.production.example`
- **Configuration Documentation:**
  - Documented `ENABLE_SECURITY_HEADERS`, `ENABLE_DOCS_IN_PRODUCTION`, `MAX_REQUEST_BODY_SIZE`, and `TRUSTED_PROXIES` with production recommended defaults.

---

## 4. Test Suite Additions

### `backend/tests/test_security_hardening.py`
- Created dedicated test module containing 16 unit and integration security tests covering:
  1. Security headers injection (`nosniff`, `DENY`, `strict-origin-when-cross-origin`, CSP, permissions).
  2. CORS credential safety rules under wildcard and specific domains.
  3. Tile coordinate bounds checking (negative zoom, excessive zoom, out-of-range x/y).
  4. Layer and tile path traversal rejection.
  5. Repository safe resolve null byte rejection.
  6. Point inspection coordinate range and model ID validation.
  7. HTTP 413 request body size enforcement.
  8. AI rate limiting and trusted proxy IP extraction.
  9. AI question length limits and structured error disclosures.
