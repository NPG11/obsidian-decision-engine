# Obsidian Decision Engine – Enterprise & Go-To-Market

Battle-tested building blocks to make the engine sellable and procurement-ready for B2B fintech buyers.

## Executive Snapshot
- **What it is:** Deterministic financial decision engine with AI-only for explanations (no AI in math paths).
- **Who it’s for:** Card issuers, BNPL, lending/servicing, digital banking, personal finance, debt optimization.
- **Why it wins:** Auditability, explainability, configurable thresholds, and drop-in REST/OpenAPI + SDKs.

## Security & Compliance Posture
- **Transport & auth:** HTTPS + `X-API-Key` (per-tenant keys). Rotate keys and restrict by IP/rate-limit; front with your API gateway or mTLS if required.
- **Data handling:** Request/response only; no persistence by default. Recommend log redaction on sensitive fields and short log retention (e.g., 30–90 days).
- **Isolation:** Deploy per-tenant namespace or VPC; separate keys + rate limits per tenant. Avoid multi-tenant data stores unless you need them.
- **Encryption:** TLS in transit; at-rest encryption depends on your cloud KMS (S3/EBS/Block volumes).
- **Compliance roadmap:** SOC 2 Type II prep, ISO 27001 alignment, annual third-party pen test; DPA + GDPR/CCPA-ready language; security one-pager and pen-test summary for buyers.
- **Access control:** Use infra IAM + firewalling for operator access; no shared accounts. Prefer SSO/SAML into ops dashboards if you add them.

## Operational Excellence
- **SLOs to offer:** 99.9% uptime, p95 latency < 300ms for core endpoints under documented load profile.
- **Health & probes:** `/health`, `/health/detailed`, `/ready`, `/live` already available; wire into Kubernetes or ECS.
- **Rate limiting:** Per key via `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`; defaults in `src/config/limits.ts`.
- **Graceful degradation:** If LLM unavailable, deterministic math still runs; set `include_ai_explanation=false` to force deterministic-only responses.
- **Observability:** Structured logs with `request_id`; add log shipping (Datadog, Splunk, OpenTelemetry) at deploy time. Recommend Prometheus metrics endpoint + dashboards (latency, error rate, rate-limit hits, AI fallback usage).
- **Resilience:** Run at least 2 replicas with HPA; enable retries/timeouts on callers; chaos checks for AI dependency loss.
- **Backups:** If you add persistence (audit store), define retention and backup frequency (e.g., daily snapshots, 30–90 day retention).

## Governance & Controls
- **Versioning:** Prefix routes (`/api/v1/...`); document deprecation windows (e.g., 90 days) and changelog.
- **Auditability:** Return `request_id` in all responses; log evaluated rules + decision, confidence, risk level. Recommend writing audit events to append-only store with tenant ID + hashed user identifier.
- **Idempotency:** Built-in `X-Idempotency-Key` support on POST endpoints with TTL (`IDEMPOTENCY_TTL_MS`). For distributed setups, back with Redis/DB.
- **Config management:** Financial thresholds in `src/config/thresholds.ts`; keep per-tenant overlays with change history.

## Integrations & Developer Experience
- **OpenAPI/Swagger:** Served at `/docs`.
- **SDKs:** JS/TS today. Recommend shipping Python + Java SDKs (generated from OpenAPI) and publishing to PyPI/Maven.
- **Webhooks:** Add outbound webhooks for decision events (`decision.created`, `decision.failed`, `rate_limit.hit`) with secret verification.
- **Idempotent, replayable flows:** Include `request_id` from responses to re-run deterministic calculations for audits.
- **Examples:** Include checkout/BNPL, card underwriting, debt payoff coaching flows. The `examples/` folder can host runnable notebooks and cURL scripts.

## Pricing & Packaging (template)
- **Sandbox (free/low):** Limited RPS, no SLA, shared infrastructure, AI explanations off by default.
- **Production:** Higher RPS, 99.9% uptime SLO, email support, AI explanations on, webhook access.
- **Enterprise:** Custom RPS, dedicated VPC/region, 24/7 support, custom models, security review, volume discounts, onboarding SLAs.
- **Add-ons:** Premium support, dedicated cluster, custom rules library, bespoke prompts/guardrails.

## Proof & Validation
- **Testing:** `npm test` / coverage; add coverage badge from CI. Include mutation or property-based tests on calculations.
- **Benchmarks:** Publish p50/p95/p99 latency and throughput under representative payloads (with and without AI).
- **Fairness & policy:** Map `reason_codes` to policy/regs; provide examples of expected decisions and edge cases.
- **Deterministic replay:** Provide a CLI or notebook to replay historical requests given `request_id` and payload for audits.

## Deployment Patterns
- **Containerized:** `Dockerfile` and `docker-compose.yml` included. For prod, run with `npm ci --only=production` and env-vars.
- **Kubernetes:** Use `/ready` and `/live` probes; configure HPA on CPU/latency; mount secrets via vault/secret manager.
- **Ingress/gateway:** Enforce TLS, mTLS if needed, IP allowlists, WAF, bot protection; inject `X-Request-ID` and validate `X-Idempotency-Key`.
- **Logging:** Ship to your centralized sink with PII redaction. Include rate-limit and AI-fallback counters in dashboards.

## Buyer-Facing Collateral to Ship
- Security one-pager (architecture, data flows, controls, compliance roadmap).
- Architecture one-pager (deterministic math + AI synthesis, rule engine, simulators).
- Demo assets: short Loom of API call + docs walkthrough; runnable Postman collection/Notebook.
- ROI calculator + at least one case study (charge-off reduction, approval lift, CSAT/retention lift).
- Procurement packet: DPA template, pen-test summary, uptime/SLA, support runbooks, escalation matrix.

## Next Steps (checklist)
- [ ] Add Prometheus `/metrics` endpoint and dashboards.
- [ ] Add webhook delivery with signature verification.
- [ ] Publish OpenAPI client SDKs for Python/Java.
- [ ] Enable idempotency keys via gateway or in-app cache/store.
- [ ] Add audit log sink + replay CLI/notebook.
- [ ] Publish latency/throughput benchmarks and coverage badge in CI.

Use this document as the buyer/procurement-ready reference and keep it updated as you ship the above checklist.
