# MCGSE Web-GIS Production Security Deployment Checklist

**Document Version:** 2.1  
**Target Architecture:** AWS Cloud (S3, CloudFront, ECS Fargate, ALB, EFS) & Docker On-Prem  
**Compliance Standard:** CIS Benchmark / AWS Well-Architected Security Pillar  

---

## Pre-Deployment Verification Matrix

Use this checklist before promoting any MCGSE Web-GIS build or infrastructure update to staging or production.

---

### 1. Environment & Secrets Management

- [ ] **No Secrets in Source Control:**
  - Verify `.env` files are excluded from Git via `.gitignore`.
  - Confirm repository contains only `.env.example` and `.env.production.example`.
- [ ] **Production Flag Set:**
  - `ENVIRONMENT=production` configured in ECS task definition or container environment.
  - Verify `/docs`, `/redoc`, and `/openapi.json` return HTTP 404 in production.
- [ ] **CORS Origins Explicitly Whitelisted:**
  - `CORS_ORIGINS` set to exact domains (e.g. `https://gis.himachal.gov.in,https://mcgse.example.com`).
  - No wildcard `*` configured with credentials.
- [ ] **Trusted Proxy CIDRs Configured:**
  - `TRUSTED_PROXIES` set to VPC subnets / ALB private IP ranges (e.g. `10.0.0.0/16`) to ensure accurate client IP identification for AI rate limiting.

---

### 2. AWS Infrastructure Hardening

#### A. Amazon S3 (Static Frontend Bucket)
- [ ] `BlockPublicAcls: true`, `BlockPublicPolicy: true`, `IgnorePublicAcls: true`, `RestrictPublicBuckets: true`.
- [ ] S3 bucket policy allows reads **only** from CloudFront Origin Access Control (OAC). Direct S3 URLs must return 403.
- [ ] Default encryption enabled (SSE-S3 or AWS KMS).

#### B. Amazon CloudFront (CDN & Edge Security)
- [ ] `ViewerProtocolPolicy: redirect-to-https` enforced on both Default Cache Behavior (`/*`) and API Behavior (`/api/*`).
- [ ] Minimum TLS protocol set to `TLSv1.2_2021` or higher.
- [ ] AWS WAF (Web Application Firewall) attached with AWS Managed Rules:
  - `AWSManagedRulesCommonRuleSet` (OWASP Top 10)
  - `AWSManagedRulesKnownBadInputsRuleSet`
  - `AWSManagedRulesAmazonIpReputationList`
- [ ] CloudFront response headers policy configured with:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`

#### C. Application Load Balancer (ALB)
- [ ] ALB configured in private VPC subnets or guarded by CloudFront Custom Header verification (`X-Origin-Verify`) so traffic cannot bypass CloudFront WAF.
- [ ] Inactive HTTP listener redirects port 80 to port 443 with `HTTP 301 Moved Permanently`.
- [ ] TLS certificate managed through AWS Certificate Manager (ACM) with automated renewal.

#### D. Amazon ECS Fargate (FastAPI Backend)
- [ ] Tasks run in private subnets with no public IP (`assign_public_ip: "DISABLED"`).
- [ ] Egress to internet routed strictly through AWS NAT Gateway.
- [ ] Non-root execution: Container executes as `USER appuser` (UID 1001).
- [ ] Read-only root filesystem enabled (`readonlyRootFilesystem: true` in ECS task definition) with ephemeral `/tmp` mounted.
- [ ] Task execution IAM role strictly scoped to ECR image pulling and CloudWatch log streaming.
- [ ] Container resource limits explicitly enforced: CPU `2048` (2 vCPU), Memory `4096` (4 GB).

#### E. Amazon EFS (Spatial Knowledge Package Storage)
- [ ] EFS Filesystem Encrypted at rest using AWS KMS.
- [ ] Transit encryption enabled (`transitEncryption: "ENABLED"` in ECS mount configuration).
- [ ] Mount point permissions set to `readOnly: true` in container definitions. Web-GIS backend must never have write access to canonical GIS packages.
- [ ] EFS Security Group allows inbound NFS (port 2049) **only** from the ECS task security group.

---

### 3. AI Engine (Ollama / Local LLM) Safeguards

- [ ] **Network Isolation:**
  - Ollama is **never** assigned a public IP or exposed to the public internet.
  - In Docker Compose: bound to `127.0.0.1:11434` or internal container network only.
  - In AWS: runs on an internal ECS task or private EC2 instance accessible solely via VPC DNS (`http://ollama-service.internal:11434`).
- [ ] **Rate Limiting Active:**
  - `AI_RATE_LIMIT_PER_MINUTE` set (recommended: 20-30 requests/minute per client).
  - Rate limiting tested and verified against IP spoofing.
- [ ] **Input Constraints Enforced:**
  - Maximum question length enforced (1000 characters).
  - Conversation history truncated to last 6 turns to avoid context stuffing / VRAM exhaustion.
- [ ] **Fallback Verification:**
  - Confirm that if Ollama service is stopped or unreachable, the API gracefully falls back to deterministic GIS evidence presentation without throwing 500 errors.

---

### 4. Application Runtime & GIS Integrity

- [ ] **GDAL / Rasterio Windowed Reads:**
  - Confirm raster queries sample pixels using windowed reads without loading multi-gigabyte rasters into memory.
- [ ] **NoData Strict Null Semantics:**
  - Confirm missing criteria return `null` and are not substituted with synthetic defaults (`0`, `1`, or `5`).
- [ ] **Coordinate Boundary Checks:**
  - Coordinate requests validated against Himachal Pradesh bounds (lat 30.38°N - 33.26°N, lon 75.57°E - 79.00°E) returning `OUTSIDE_ANALYSIS_AREA` rather than crashing.
- [ ] **Map Tile Coordinate Caps:**
  - Tile requests validated to `0 <= z <= 22` and slippy tile boundaries.
- [ ] **XSS Sanitization Active:**
  - Verify `escapeHtml` neutralizes script injection in AI Markdown rendering.

---

### 5. Monitoring & Incident Response

- [ ] **AWS CloudWatch Container Insights:**
  - Alarms configured for ECS CPU utilization > 80% and Memory utilization > 80%.
  - Log metric filter for HTTP 5xx errors alerting on > 10 errors per minute.
  - Rate limit alert tracking HTTP 429 surges.
- [ ] **Health Check Automation:**
  - ALB target group probes `/api/v1/health` every 30 seconds with 5-second timeout.
  - Degraded or missing spatial package triggers unhealthy target deregistration.
- [ ] **Automated Backup:**
  - AWS Backup configured for weekly snapshots of the canonical EFS spatial volume.
