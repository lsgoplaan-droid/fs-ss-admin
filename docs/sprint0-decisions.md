# Sprint 0 Decisions

All open questions resolved before Sprint 1 begins.

---

## Open Questions (from CEO Plan)

### Q1 — Backend Lead Availability
**Status:** Resolved (external)
**Decision:** Backend development begins Week 1 of Sprint 1 with assigned lead.
**Note:** Staffing confirmed outside this document.

### Q2 — Transactional Email Provider
**Status:** RESOLVED
**Decision:** AWS SES (ap-south-1)
**Rationale:** Already in AWS ecosystem; cost-effective at scale; SES sandbox → production promotion handled via AWS console before Sprint 1 go-live.
**Config:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION=ap-south-1`, `EMAIL_FROM`
**Templates:** Password reset, welcome email — plain-text + HTML versions in `src/lib/email/templates/`.

### Q3 — Access Token TTL
**Status:** DEFERRED to Sprint 1
**Decision:** Default 15 minutes for Phase 1 launch. Customer sign-off not required before Sprint 0.
**Configured via:** `JWT_ACCESS_TTL_SECONDS` env var (default: 900).
**Review trigger:** If enterprise customer requests shorter TTL during onboarding, raise as Sprint 1 config ticket.

### Q4 — In-App Notifications
**Status:** RESOLVED
**Decision:** In-app only for Phase 1. No email/SMS notification system.
**Mechanism:** TenantBroadcast table polled on page load / focus; unread count in nav badge.
**Phase 2:** Push notifications or email digest can be layered onto the existing TenantBroadcast model.

### Q5 — Juspay Integration
**Status:** RESOLVED
**Decision:** Phase 1.5 (not Phase 1).
**Impact:** `POST /api/tenant/payment-gateways/:id/test` returns 501 `NOT_IMPLEMENTED` for `provider=JUSPAY`.
**MSW:** `gateways.ts` handler already implements the 501 fixture.
**Schema:** JUSPAY is a valid `GatewayProvider` enum value in Prisma — no migration needed when Phase 1.5 ships.

---

## Engineering Review Decisions

These were resolved during the `/plan-eng-review` session.

| # | Decision | Chosen |
|---|----------|--------|
| 1 | Redis dependency for rate limiting | Upstash Redis (consolidated with session registry) |
| 2 | OpenAPI code generation | `openapi-typescript` → type-only generation; no runtime client codegen |
| 3 | Shared schema package | No `packages/schemas/` for Phase 1 — pragmatic duplication acceptable |
| 4 | Audit log pagination | Cursor-based (keyset on `(tenant_id, timestamp DESC)`) |
| 5 | Approval timeout cron concurrency | Redis SETNX distributed lock (single-instance guard) |
| 6 | Session registry storage | Upstash Redis (`SESSION_KEY(userId)`) — single concurrent session |
| 7 | RLS mechanism | `withTenantContext()` via transaction-scoped `set_config` (not `SET LOCAL`) |
| 8 | impersonation token refresh loop | `isImpersonationToken()` guard in 401 handler — skip refresh, redirect to /platform/tenants |

---

## Scope Decisions Archive

| Item | Decision | Sprint |
|------|----------|--------|
| DPDP compliance | DPDP-ready (schema stubs only), not compliant | Phase 1 |
| Key rotation UI | Documented in `docs/encryption-rotation.md`, not implemented | Phase 1 |
| Email notifications | In-app only | Phase 1 |
| Juspay gateway | 501 stub, full integration deferred | Phase 1.5 |
| Shared schema package | Duplication accepted | Phase 1 |
| DB indexes | Migration script in `TODOS.md` T7 | Pre-launch |
