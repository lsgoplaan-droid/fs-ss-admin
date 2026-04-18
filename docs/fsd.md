# Functional Specification Document (FSD)
## Matrix Emart — Multi-Tenant Marketplace Governance Admin Platform
**Version:** 1.0 | **Date:** 2026-04-17 | **Status:** APPROVED

---

## 1. System Overview

### 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                            │
│   Next.js 15 App Router · shadcn/ui · TanStack Query           │
│   /login  /platform/*  /tenant/*                                │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS · HTTP-only cookies (JWT)
┌────────────────────────▼────────────────────────────────────────┐
│                    Next.js API Routes                           │
│   /api/auth/**  /api/tenant/**  /api/platform/**               │
│   Middleware: JWT verify · route guard · rate limit · tenant_id │
└───────┬────────────────┬─────────────────────┬──────────────────┘
        │                │                     │
┌───────▼──────┐  ┌──────▼───────┐  ┌──────────▼──────────┐
│  PostgreSQL  │  │ Upstash Redis│  │   AWS SES (email)   │
│  (RLS + PG)  │  │  (sessions + │  │  ap-south-1         │
│  Prisma 6.x  │  │   rate limit)│  │                     │
└──────────────┘  └──────────────┘  └─────────────────────┘
```

### 1.2 Role-Based Routing

| Role | Entry Point | Access |
|------|-------------|--------|
| `platform_admin` | `/platform/dashboard` | All `/platform/*` routes; can impersonate any tenant |
| `tenant_admin` | `/tenant/dashboard` | All `/tenant/*` routes for their tenantId |

### 1.3 Token Architecture

```
Login Response
    ├── Access Token (15min, HTTP-only cookie)
    │     └── { userId, role, tenantId, permissions[], impersonatedBy? }
    └── Refresh Token (7 days, HTTP-only cookie, rotated on use)

Impersonation Token (30min, non-renewable)
    └── { userId, role: tenant_admin, tenantId: target, impersonatedBy: platformUserId }
```

---

## 2. Module Specifications

---

### 2.1 Authentication

#### 2.1.1 Login Flow

**Endpoint:** `POST /api/auth/login`

**Input:**
```
email: string (required)
password: string (required)
```

**Business Rules:**
- Validate email + password against bcrypt hash
- If `failedLoginCount >= maxFailedAttempts` and `lockoutUntil > now()` → return 401 `ACCOUNT_LOCKED`
- On success: invalidate any existing session in Redis (`SESSION_KEY(userId)`), register new session
- If `mustResetPassword = true` → return `requiresPasswordReset: true` in response body
- If `twoFactorEnabled = true` → return `requiresTwoFactor: true`; do not issue full access token yet
- Set access token + refresh token in HTTP-only cookies

**States handled by login screen:**
1. Standard login
2. First-login password reset
3. Concurrent session warning ("Your previous session was terminated")
4. 2FA code prompt (Phase 1: TOTP only)
5. Account locked message with lockout expiry time

#### 2.1.2 Token Refresh

**Endpoint:** `POST /api/auth/refresh`

**Business Rules:**
- Verify refresh token signature and expiry
- If `isImpersonationToken(accessToken)` → do NOT refresh; return 401 (client redirects to /platform/tenants)
- Check session registry: if `SESSION_KEY(userId)` does not match stored sessionId → return 401 `SESSION_INVALIDATED`
- Issue new access token with **current** permissions from database (not copied from old token)
- Rotate refresh token (issue new, invalidate old)

#### 2.1.3 Password Policy Engine

| Rule | Default | Configurable |
|------|---------|--------------|
| Minimum length | 8 chars (tenant admin), 12 chars (platform admin) | Yes |
| Complexity | Must contain uppercase, lowercase, number, special char | No |
| Expiry | 90 days | Yes (per tenant security settings) |
| History | Cannot reuse last 5 passwords | No |
| Lockout threshold | 5 failed attempts | Yes |
| Lockout duration | 30 minutes | Yes |

---

### 2.2 Role Management

**Routes:** `GET/POST /api/tenant/roles`, `GET/PUT/DELETE /api/tenant/roles/:id`, `PUT /api/tenant/roles/:id/permissions`

#### 2.2.1 Permissions Matrix

All permissions follow the `module.action` dot-string convention:

| Module | Actions |
|--------|---------|
| roles | view, create, edit, delete |
| users | view, create, edit, delete |
| gateways | view, create, edit, delete |
| payment_modes | view, create, edit, delete |
| settings | view, edit |
| approvals | view, create, edit, delete, approve |
| audit | view, export |
| tax | view, edit |
| broadcasts | view |
| platform.tenants | view, create, edit, suspend |
| platform.subscriptions | view, edit |
| platform.users | view, create, edit |
| platform.security | view, edit |
| platform.audit | view, export |

**Business Rules:**
- Role name must be unique per tenant (`DUPLICATE_ROLE_NAME` → 409)
- Roles with active users cannot be deleted (return 409 `ROLE_HAS_ACTIVE_USERS`)
- Permission changes take effect at the user's next token refresh (15-min window)
- For immediate revocation: deactivate the user (session invalidated in Redis)

---

### 2.3 Administrative Users

**Routes:** `GET/POST /api/tenant/users`, `GET/PUT /api/tenant/users/:id`, `PATCH /api/tenant/users/:id/status`

**Business Rules:**
- Email must be unique globally (not just per tenant)
- New user created with `mustResetPassword: true`; system sends activation email via AWS SES
- Status toggle: ACTIVE ↔ INACTIVE; INACTIVE users cannot log in; active sessions invalidated in Redis on deactivation
- Soft-delete only — no hard delete in Phase 1
- `planLimit` enforced: cannot create user if `count(active users) >= plan.maxUsers`

---

### 2.4 Payment Gateway Setup

**Routes:** `GET/POST /api/tenant/payment-gateways`, `GET/PUT/DELETE /api/tenant/payment-gateways/:id`, `POST /api/tenant/payment-gateways/:id/test`, `PATCH /api/tenant/payment-gateways/:id/status`

#### 2.4.1 Gateway Modes

| Mode | Description |
|------|-------------|
| Direct | Single gateway (Razorpay or Cashfree) handles all transactions; `routingPriority` sets fallback order |
| Aggregator | Juspay as primary processor; sub-gateway routing managed inside Juspay dashboard |

**Business Rules:**
- `apiKey` and `apiSecret` stored as AES-256-GCM ciphertext; plaintext never logged or returned to client
- `planLimit` enforced: cannot add gateway if `count(active gateways) >= plan.maxGateways`
- `POST /:id/test` calls gateway credential verification (not a live transaction):
  - Razorpay: `/v1/accounts` ping
  - Cashfree: `/pg/orders` dry-run
  - Juspay: 501 `NOT_IMPLEMENTED` in Phase 1
- Test endpoint rate-limited: 5/min/tenant

#### 2.4.2 Payment Modes

Each mode (`UPI`, `COD`, `WALLET`, `DEBIT_CARD`, `CREDIT_CARD`, `NET_BANKING`) links to one or more gateways via the `PaymentModeGateway` join table with `priorityOrder`.

---

### 2.5 Settings

#### 2.5.1 General Settings
Company display name, logo URL, favicon URL, SEO title/description/keywords, website URL, support email, phone, address, social media links, app store links.

#### 2.5.2 Security Settings

| Setting | Default | Validation |
|---------|---------|------------|
| sessionTimeoutHours | 8 | 1–24 |
| passwordExpiryDays | 90 | 30–365 |
| passwordMinLength | 8 | 6–32 |
| maxFailedAttempts | 5 | 3–10 |
| lockoutDurationMins | 30 | 5–1440 |
| requireTwoFactor | false | boolean |
| ipWhitelist | [] | CIDR notation array |

#### 2.5.3 Tax Settings
GSTIN (15-char alphanumeric, server-side checksum validation), legal name, registered address, tax type (Regular/Composition), invoice prefix, starting number, terms & conditions, digital signature upload.

---

### 2.6 Workflow & Approvals

**Routes:** `GET/POST /api/tenant/approval-workflows`, `GET/PUT/DELETE/PATCH /api/tenant/approval-workflows/:id`, `GET /api/tenant/approval-instances`, `GET /api/tenant/approval-instances/:id`, `POST /api/tenant/approval-instances/:id/approve`, `POST /api/tenant/approval-instances/:id/reject`

#### 2.6.1 Trigger Events

| Event | When triggered |
|-------|---------------|
| `product_listing` | Vendor submits a new product for listing |
| `pricing_change` | Pricing update on an existing listed product |
| `order_cancellation` | Order cancellation request above a threshold |
| `vendor_activation` | New vendor onboarding approval |

#### 2.6.2 Level Configuration

Each level (1–5) defines:
- `approverRoleId` — which role can approve at this level
- `timeoutHours` — default 48h
- `onTimeoutAction` — `AUTO_APPROVE` | `ESCALATE` | `REJECT`
- `escalationRoleId` — required when onTimeoutAction = `ESCALATE`; if role has zero active members → auto-reject

#### 2.6.3 Workflow Versioning (Contract-at-Signing)

```
Edit workflow → creates WorkflowVersion snapshot
    │
    ├── Existing ApprovalInstances (PENDING)
    │     └── continue reading WorkflowLevelSnapshot for their pinned version
    │         (rules do not change mid-approval)
    │
    └── New ApprovalInstances
          └── pin to latest WorkflowVersion
```

#### 2.6.4 Approval Timeout Cron

- Runs every 15 minutes
- Acquires Redis SETNX lock (`cron:approval-timeout:lock`, TTL 300s)
- Queries instances where `current_level_started_at + timeout_hours < NOW()` AND `status = 'PENDING'`
- CAS UPDATE: `WHERE status = 'PENDING'` guard prevents double-processing
- See `docs/approval-timeout-cron.md` for full spec

---

### 2.7 Audit & Monitoring

**Route:** `GET /api/tenant/audit-logs`

**Pagination:** Cursor-based (keyset on `(tenant_id, timestamp DESC)`) — no LIMIT/OFFSET

**Filters:** actorUserId, entityType, entityId, action, dateFrom, dateTo

**Export:** CSV + Excel via query param `?format=csv`

**Immutability enforcement:** PostgreSQL RLS policy denies UPDATE + DELETE for all application roles on `audit_logs`

**`<AuditDiffViewer>`:** Frontend component renders two-column before/after diff when a row is expanded. `beforeState` and `afterState` JSON columns already in schema.

---

### 2.8 Tenant Management (Platform Admin)

**Routes:** `GET/POST /api/platform/tenants`, `GET /api/platform/tenants/:id`, `PATCH /api/platform/tenants/:id/status`, `POST /api/platform/tenants/:id/impersonate`

#### 2.8.1 Tenant Lifecycle

```
DRAFT ──► PROVISIONING ──► ACTIVE ──► SUSPENDED ──► TERMINATED
  │                            │                         │
  │ (credentials sent)         │ (all access blocked,    │ (30-day data
  │                            │  data retained,         │  retention hold,
  └── onboarding checklist     │  reversible)            │  then manual delete)
      tracked here
```

#### 2.8.2 Onboarding Checklist

Mandatory items (Provisioning → Active transition blocked until complete):
- ✓ GSTIN configured
- ✓ First admin user invited
- ✓ Payment gateway added

Optional items (tracked, not blocking):
- ✓ First role created
- ✓ Approval workflow configured

#### 2.8.3 Impersonation

1. Platform admin clicks "Switch to Tenant"
2. `POST /api/platform/tenants/:id/impersonate` → 422 if `onboardingComplete = false`
3. Backend issues scoped JWT (30 min, non-renewable, `impersonatedBy` claim)
4. Frontend displays persistent banner: "Viewing as Tenant: [name] — Exit Impersonation"
5. All actions write `impersonatedBy` in AuditLog + dual-write (tenant audit + platform audit)
6. Exit: clear scoped token, restore platform admin session

**Restrictions during impersonation:**
- Password changes blocked (`IMPERSONATION_RESTRICTED` → 403)
- 2FA changes blocked
- API key generation blocked
- Token refresh blocked (401 handler detects `impersonatedBy` claim → skip refresh)

---

### 2.9 Subscription Management

**Routes:** `GET/POST /api/platform/subscriptions/plans`, `GET/PUT /api/platform/subscriptions/plans/:id`, `PATCH /api/platform/tenants/:id/subscription`

#### 2.9.1 Entitlements

| Field | Type | Description |
|-------|------|-------------|
| maxUsers | Int | Max Tenant Admin users |
| maxGateways | Int | Max payment gateways |
| modulesAllowed | String[] | Enabled module keys |
| apiAccess | Boolean | Developer Settings / API Keys unlocked |
| supportTier | BASIC/STANDARD/PREMIUM | Support SLA |
| approvalWorkflowLevels | Int | Max approval chain levels |

#### 2.9.2 Plan Change Workflow

- **Immediate**: new entitlements applied instantly; if downgrade exceeds usage → warning + confirm (`DOWNGRADE_EXCEEDS_USAGE`)
- **At Renewal**: queued in `TenantPlanChange`; current entitlements continue until `effectiveAt`

---

### 2.10 Platform Broadcasts

**Routes:** `GET/POST /api/platform/broadcasts`, `GET /api/platform/broadcasts/:id`, `PATCH /api/platform/broadcasts/:id/status`

**Delivery model (Phase 1 — in-app only, no email):**
- On Tenant Admin login: `GET /tenant/broadcasts` returns unread broadcasts
- Displayed as dismissible banners, newest first
- `PATCH /tenant/broadcasts/:id/read` creates TenantBroadcastRead record

---

### 2.11 Platform Health Dashboard

**Route:** `GET /api/platform/tenants/:id/metrics`

Reads from `TenantMetricSnapshot` (written by nightly analytics cron). If no snapshot exists, returns `lastLoginAt` from User entity only.

**Usage vs. entitlement alerts:**
- `activeUsers30d / plan.maxUsers >= 0.8` → "Approaching Limit" badge
- `gateways / plan.maxGateways >= 0.8` → "Approaching Limit" badge

---

### 2.12 Platform Security

**Routes:** `GET /api/platform/security/sessions`, `DELETE /api/platform/security/sessions/:userId`, `GET/POST /api/platform/security/api-keys`, `DELETE /api/platform/security/api-keys/:id`

- Terminate any user's session by deleting their Redis session key
- API Keys: bcrypt-hashed; plaintext shown once on creation, never stored

---

## 3. Cross-Cutting Concerns

### 3.1 Error Envelope (all API responses)

```json
{
  "error": {
    "code": "SCREAMING_SNAKE_CASE",
    "message": "Human-readable description",
    "field": "optional_field_name"
  }
}
```

**Common error codes:**

| Code | HTTP | Description |
|------|------|-------------|
| INVALID_CREDENTIALS | 401 | Wrong email or password |
| ACCOUNT_LOCKED | 401 | Too many failed attempts |
| TOKEN_EXPIRED | 401 | Access token expired |
| SESSION_INVALIDATED | 401 | Session terminated (concurrent login) |
| IMPERSONATION_RESTRICTED | 403 | Action blocked during impersonation |
| NOT_FOUND | 404 | Resource does not exist |
| DUPLICATE_ROLE_NAME | 409 | Role name already exists for tenant |
| PLAN_LIMIT_EXCEEDED | 422 | Plan entitlement limit reached |
| ONBOARDING_INCOMPLETE | 422 | Tenant not ready for impersonation |
| DOWNGRADE_EXCEEDS_USAGE | 422 | Downgrade would exceed current usage |
| GATEWAY_CREDENTIAL_UNAVAILABLE | 500 | Decryption failure (logged, not exposed) |
| NOT_IMPLEMENTED | 501 | Juspay Phase 1.5 |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |

### 3.2 Rate Limits

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /api/auth/login` | 10 | 1 min | IP address |
| `POST /api/auth/refresh` | 30 | 1 min | IP address |
| `POST /api/tenant/payment-gateways/:id/test` | 5 | 1 min | tenant_id |

### 3.3 Multi-Tenancy Isolation

Every tenant DB operation must run inside `withTenantContext(tenantId, fn)`:

```typescript
// Sets transaction-scoped PostgreSQL session variable
// PostgreSQL RLS policy: USING (tenant_id = current_setting('app.tenant_id'))
await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
```

Middleware injects headers: `x-user-id`, `x-user-role`, `x-tenant-id`, `x-session-id`, `x-impersonated-by`

### 3.4 Audit Logging Rules

Every state-changing API operation must write an AuditLog row:
- `action`: dot-notation verb, e.g., `role.created`, `gateway.status_changed`
- `beforeState`: JSON snapshot before change (null for creates)
- `afterState`: JSON snapshot after change (null for deletes)
- `impersonatedBy`: populated if request header `x-impersonated-by` is set
- Impersonated actions write two rows: one with `tenantId` (tenant audit), one with `tenantId: null` (platform audit)

### 3.5 Frontend State Management

- All server state via TanStack Query; cache keys always prefixed with `[tenantId]`
- `useTenantQuery(key, fn)` — auto-prepends tenantId
- Mutations invalidate scoped keys: `[tenantId, 'roles']`, never bare `['roles']`
- `useAuth()` — loads session, exposes `user`, `hasPermission(dot-string)`, `logout()`
- `<PermissionGate permission="roles.create">` — renders children only if user has permission

---

## 4. API Contract Reference

Full OpenAPI 3.1 specification: `docs/api-contracts/phase1.yaml`

**Endpoint count:** 65 endpoints across 15 modules

| Module | GET | POST | PUT | PATCH | DELETE |
|--------|-----|------|-----|-------|--------|
| Auth | — | 5 | — | — | — |
| Tenant Roles | 2 | 1 | 2 | — | 1 |
| Tenant Users | 2 | 1 | 1 | 1 | — |
| Payment Gateways | 2 | 2 | 1 | 1 | 1 |
| Payment Modes | 2 | 1 | 1 | 1 | 1 |
| Settings | 3 | — | 3 | — | — |
| Approvals | 4 | 3 | 1 | 1 | 1 |
| Tenant Audit | 1 | — | — | — | — |
| Tenant Broadcasts | 1 | — | — | 1 | — |
| Platform Tenants | 2 | 2 | — | 1 | — |
| Platform Subscriptions | 3 | 1 | 1 | 1 | — |
| Platform Users | 2 | 1 | — | 1 | — |
| Platform Security | 2 | 1 | — | — | 2 |
| Platform Audit | 1 | — | — | — | — |
| Platform Broadcasts | 2 | 1 | — | 1 | — |
| Platform Search | 1 | — | — | — | — |

---

## 5. Data Retention & Deletion Policy

| Entity | Retention | Hard Delete |
|--------|-----------|-------------|
| Tenant Admin Users | Soft-delete (INACTIVE status) | No |
| Tenants | 30-day hold after TERMINATED | Manual ops only |
| Audit Logs | Indefinite (append-only, RLS immutable) | No |
| Payment Gateway Credentials | Retained until tenant terminated | No |
| DPDP Data Subject Requests | Retained for compliance | Manual ops per request |

---

## 6. Deployment Architecture

```
GitHub Actions CI/CD
    │
    ├── PR merge → staging deploy (Vercel preview)
    └── Release tag → production deploy (Vercel production)

Environment: Vercel + AWS RDS PostgreSQL (ap-south-1) + Upstash Redis + AWS SES

Cron jobs (Vercel Cron):
    ├── /api/cron/approval-timeout   every 15 min
    └── /api/cron/metrics-snapshot   nightly
```
