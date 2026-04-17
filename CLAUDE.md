# CLAUDE.md — fs-ss-admin (Matrix Emart Admin Platform)

## What This Project Is

Multi-tenant marketplace governance admin platform for Indian enterprise retailers going multi-vendor. Single Next.js 15 App Router app with two distinct admin layers:

- **Platform Admin** (`/platform/*`) — super-admin: create/govern tenants, manage plans, oversee security
- **Tenant Admin** (`/tenant/*`) — per-tenant: configure payment gateways, roles, approvals, audit, settings

One paying customer committed (Matrix Emart). Phase 1 = 15 modules (8 Tenant Admin + 7 Platform Admin).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15.3 (App Router, RSC) |
| Language | TypeScript 5.8 |
| UI | shadcn/ui + Tailwind CSS |
| Server state | TanStack Query v5 (`useTenantQuery` — prepends tenantId to all cache keys) |
| Forms | React Hook Form + Zod |
| Auth | Custom JWT (jose), HTTP-only cookies |
| ORM | Prisma 6.x (PostgreSQL) |
| Redis | Upstash Redis (session registry + rate limiting) |
| Email | AWS SES (ap-south-1) |
| Encryption | AES-256-GCM (`ENCRYPTION_MASTER_KEY` = 64 hex chars) |
| Mocks | MSW 2.x (`src/mocks/handlers/`) |
| Unit tests | Vitest 3 + React Testing Library |
| E2E tests | Playwright |

## Sprint Status

- **Sprint 0**: COMPLETE — OpenAPI spec, MSW handlers, Prisma schema, core lib, docs
- **Sprint 1**: NOT STARTED (Auth system + shared layout)
- See sprint plan in conversation history for full schedule (target launch ~2026-09-04)

## Key Files

| File | Purpose |
|------|---------|
| `docs/api-contracts/phase1.yaml` | OpenAPI 3.1 spec — source of truth for all 65 endpoints |
| `prisma/schema.prisma` | Full DB schema — all entities, indexes, RLS hints |
| `src/lib/permissions.ts` | PERMISSIONS enum — all dot-strings (roles.view, gateways.create, etc.) |
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt + GatewayDecryptError |
| `src/lib/auth/jwt.ts` | JWT sign/verify + AccessTokenPayload + isImpersonationToken() |
| `src/lib/db/tenant-context.ts` | withTenantContext() — RLS middleware, transaction-scoped set_config |
| `src/lib/redis.ts` | Upstash client + rate limiters (login, refresh, gatewayTest) |
| `src/lib/startup-checks.ts` | Validates env vars + ENCRYPTION_MASTER_KEY length; process.exit(1) on fail |
| `src/middleware.ts` | Route guards: /platform/* → platform_admin, /tenant/* → non-null tenantId |
| `src/hooks/useTenantQuery.ts` | TanStack Query wrapper — prepends [tenantId] to all cache keys |
| `src/mocks/handlers/index.ts` | MSW handler barrel — all 16 modules |
| `docs/sprint0-decisions.md` | All 5 open questions resolved + 8 eng review decisions |
| `docs/approval-timeout-cron.md` | Cron spec: Redis SETNX lock, CAS UPDATE, empty-role handling |
| `docs/encryption-rotation.md` | AES key rotation procedure + migration script |
| `TODOS.md` | T1–T8: deferred items with effort estimates |

## Architecture Decisions (do not relitigate without good reason)

### Auth
- Custom JWT — NOT next-auth (needed: 90-day password expiry, single concurrent session, 2FA, IP whitelist)
- HTTP-only cookies (not localStorage)
- Access token: 15 min TTL (`JWT_ACCESS_TTL_SECONDS=900`)
- Refresh token: 7 days, rotated on use
- Single concurrent session: Redis `SESSION_KEY(userId)` — new login invalidates prior session

### Impersonation
- Platform admin issues scoped 30-min JWT with `impersonatedBy` claim
- Non-renewable — `isImpersonationToken()` guard in 401 handler skips refresh, redirects to /platform/tenants
- Password changes, 2FA changes, API key generation blocked during impersonation
- All actions audit-logged with `impersonatedBy` populated

### Multi-tenancy / RLS
- `withTenantContext(tenantId, fn)` — wraps every tenant DB operation in a transaction with `set_config('app.tenant_id', tenantId, true)` (transaction-scoped, not session-scoped)
- Middleware injects `x-tenant-id` header; `withTenantContext` reads it
- If tenantId is null when `withTenantContext` is called → throw immediately (programming error), log ERROR, return 500
- All tenant routes enforce non-null tenantId (400 if null)

### TanStack Query
- ALL queries use `useTenantQuery` — prepends `[tenantId]` to queryKey
- ALL mutation invalidations must also use `[tenantId, ...key]` scoped keys
- Never call `queryClient.invalidateQueries(['roles'])` — always `queryClient.invalidateQueries([tenantId, 'roles'])`

### Payment Gateway Encryption
- AES-256-GCM, 96-bit IV, 128-bit auth tag
- Stored format: `base64(iv):base64(ciphertext):base64(authTag)`
- `decryptCredential()` throws `GatewayDecryptError` — never returns null
- `ENCRYPTION_MASTER_KEY` validated at startup (must be exactly 64 hex chars = 32 bytes)
- Key rotation procedure: `docs/encryption-rotation.md`

### Approval Workflows
- WorkflowVersion + WorkflowLevelSnapshot: immutable copy pinned at submission (contract-at-signing)
- `ApprovalInstance.workflowVersionId` — always reads snapshot, never live WorkflowLevel
- Timeout cron: Redis SETNX lock + CAS `UPDATE WHERE status='PENDING'` guard
- Empty escalation role → auto-reject with audit note

### Rate Limiting
- Upstash sliding window: login 10/min/IP, refresh 30/min/IP, gateway test 5/min/tenant
- All rate limits return 429 with `{ error: { code: "RATE_LIMIT_EXCEEDED" } }`

## Error Envelope (ALL API responses)

```json
{ "error": { "code": "SCREAMING_SNAKE_CASE", "message": "Human-readable", "field": "optional" } }
```

Never deviate from this format. Error codes are documented in `docs/api-contracts/phase1.yaml`.

## Juspay

Phase 1.5 only. `POST /api/tenant/payment-gateways/:id/test` returns 501 `NOT_IMPLEMENTED` for `provider=JUSPAY`. MSW handler already implements this. Do not add Juspay implementation in Phase 1.

## India-Specific

- GSTIN: 15-char alphanumeric, checksum validated server-side
- Payment providers: Razorpay, Cashfree (Phase 1); Juspay (Phase 1.5)
- Currency: INR default
- AWS SES region: ap-south-1

## DPDP (Data Protection)

Phase 1 is DPDP-**ready**, not DPDP-compliant. Schema stubs exist (`DataSubjectRequest`, `pii_fields`, `User.deletedByDpdp`). No erasure execution in Phase 1 — manual ops procedure only. Do not build DPDP enforcement UI until Phase 2 DPDP sprint.

## What's NOT In Scope (Phase 1)

- Webhook infrastructure (T1 — Phase 1.5)
- KMS for gateway credentials (T3 — Phase 1.5)
- DPDP UI (Phase 2)
- Developer Settings / API Keys UI (Phase 2 — schema stubbed)
- i18n / localization
- Usage-based billing
- Mobile app
- Email notification templates UI

## Pre-Launch Requirements (before go-live)

- **T7**: 4 DB index migrations (`idx_audit_tenant_ts`, `idx_wf_level`, `idx_approval_action`, `idx_broadcast_read`)
- **T8**: Impersonation token expiry UX (401 handler guard) — build at Step 11.5
- **T5**: Load testing baseline (k6, staging environment)
- RLS integration test: real PostgreSQL, confirm query outside `withTenantContext` returns zero rows

## Design Doc Location

`C:\Users\lsgop\.gstack\projects\fs-ss-admin\lsgop-unknown-design-20260417-171940.md`

CEO Plan: `C:\Users\lsgop\.gstack\projects\fs-ss-admin\ceo-plans\2026-04-17-matrix-emart-admin-platform.md`

Eng Review Test Plan: `C:\Users\lsgop\.gstack\projects\fs-ss-admin\lsgop-unknown-eng-review-test-plan-20260417-182646.md`
