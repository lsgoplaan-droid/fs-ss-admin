# Sequence Diagrams
## Matrix Emart Admin Platform — Phase 1

---

## 1. Login Flow (Standard)

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser
    participant MW as Middleware
    participant A as Auth API
    participant DB as PostgreSQL
    participant R as Redis
    participant SES as AWS SES

    U->>B: Enter email + password
    B->>A: POST /api/auth/login
    A->>MW: Rate limit check (10/min/IP)
    alt Rate limit exceeded
        MW-->>B: 429 RATE_LIMIT_EXCEEDED
    end
    A->>DB: SELECT user WHERE email = ?
    alt User not found
        A-->>B: 401 INVALID_CREDENTIALS
    end
    A->>A: bcrypt.verify(password, hash)
    alt Password wrong
        A->>DB: INCREMENT failedLoginCount
        alt failedLoginCount >= maxFailedAttempts
            A->>DB: SET lockoutUntil = now() + lockoutDuration
            A-->>B: 401 ACCOUNT_LOCKED
        end
        A-->>B: 401 INVALID_CREDENTIALS
    end
    A->>DB: RESET failedLoginCount = 0
    A->>R: DEL SESSION_KEY(userId) [invalidate prior session]
    A->>R: SET SESSION_KEY(userId) = newSessionId
    A->>A: signAccessToken(payload)
    A->>A: signRefreshToken(userId)
    alt mustResetPassword = true
        A-->>B: 200 { requiresPasswordReset: true }
        B->>U: Redirect to /change-password
    else twoFactorEnabled = true
        A-->>B: 200 { requiresTwoFactor: true }
        B->>U: Show TOTP prompt
    else Normal login
        A-->>B: 200 { user, accessToken, refreshToken } (HTTP-only cookies)
        B->>U: Redirect to /platform/dashboard OR /tenant/dashboard
    end
```

---

## 2. Token Refresh + 401 Recovery

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser
    participant API as Any API Route
    participant AUTH as Auth API
    participant R as Redis

    B->>API: Request with expired access token
    API-->>B: 401 TOKEN_EXPIRED

    B->>B: 401 interceptor fires
    B->>B: isImpersonationToken(accessToken)?

    alt Token has impersonatedBy claim
        B->>B: Clear scoped token
        B->>B: Restore platform admin session
        B->>U: Redirect /platform/tenants + toast "Impersonation session expired"
    else Normal token
        B->>AUTH: POST /api/auth/refresh
        AUTH->>AUTH: verifyRefreshToken()
        AUTH->>R: GET SESSION_KEY(userId)
        alt Session invalidated (concurrent login)
            AUTH-->>B: 401 SESSION_INVALIDATED
            B->>U: Redirect /login + toast "Session terminated"
        else Session valid
            AUTH->>AUTH: signAccessToken (fresh permissions from DB)
            AUTH->>AUTH: signRefreshToken (rotated)
            AUTH-->>B: 200 { user, new tokens }
            B->>API: Retry original request
            API-->>B: Original response
        end
    end
```

---

## 3. Platform Admin Impersonation Flow

```mermaid
sequenceDiagram
    actor PA as Platform Admin
    participant B as Browser
    participant PT as Platform Tenants API
    participant AUTH as Auth API
    participant DB as PostgreSQL
    participant AL as Audit Log

    PA->>B: Click "Switch to Tenant" on tenant row
    B->>PT: POST /api/platform/tenants/:id/impersonate
    PT->>DB: SELECT tenant WHERE id = ?
    alt Tenant not found
        PT-->>B: 404 NOT_FOUND
    end
    alt onboardingComplete = false
        PT-->>B: 422 ONBOARDING_INCOMPLETE
    end
    PT->>AUTH: signAccessToken({ role: tenant_admin, tenantId: target, impersonatedBy: platformUserId, exp: +30min })
    PT->>AL: INSERT audit_log { action: IMPERSONATION_STARTED, tenantId: null, impersonatedBy: null }
    PT->>AL: INSERT audit_log { action: IMPERSONATION_STARTED, tenantId: target }
    PT-->>B: 200 { scopedToken, tenantName }

    B->>B: Store scoped token alongside platform token
    B->>B: Render ImpersonationBanner "Viewing as Tenant: [name]"
    B->>B: Load /tenant/dashboard using scopedToken

    Note over B: All tenant actions use scopedToken (30 min, non-renewable)

    alt Impersonation token expires (30 min)
        B->>B: 401 interceptor: detects impersonatedBy claim
        B->>B: Clear scoped token
        B->>U: Redirect /platform/tenants + toast "Impersonation session expired"
    else PA clicks "Exit Impersonation"
        B->>AUTH: POST /api/auth/logout (scoped token)
        AUTH-->>B: 204
        B->>B: Clear scoped token, restore platform admin context
        B->>B: Redirect to /platform/tenants
    end
```

---

## 4. Approval Workflow — Submission to Resolution

```mermaid
sequenceDiagram
    actor TA as Tenant Admin (Initiator)
    actor AP1 as Approver L1 (Manager)
    actor AP2 as Approver L2 (Head)
    participant API as Approvals API
    participant DB as PostgreSQL
    participant CRON as Timeout Cron
    participant AL as Audit Log

    TA->>API: POST /api/tenant/approval-instances (entityType, entityId)
    API->>DB: SELECT workflow WHERE triggerEvent = entityType AND status = ACTIVE
    API->>DB: SELECT latest WorkflowVersion (pins snapshot)
    API->>DB: INSERT ApprovalInstance { workflowVersionId, currentLevel: 1, status: PENDING }
    API->>AL: log { action: APPROVAL_SUBMITTED }
    API-->>TA: 201 ApprovalInstance

    Note over AP1: Approver L1 sees pending item in dashboard

    AP1->>API: POST /api/tenant/approval-instances/:id/approve { notes }
    API->>DB: SELECT ApprovalInstance WHERE id = ? AND status = PENDING (CAS)
    alt Instance no longer PENDING (concurrent action)
        API-->>AP1: 409 CONCURRENT_ACTION
    end
    API->>DB: INSERT ApprovalActionRecord { level: 1, action: APPROVE }
    API->>DB: SELECT WorkflowLevelSnapshot WHERE versionId = ? AND levelNumber = 2
    alt Level 2 exists
        API->>DB: UPDATE ApprovalInstance SET currentLevel = 2
        API->>AL: log { action: APPROVAL_LEVEL_ADVANCED, from: 1, to: 2 }
        API-->>AP1: 200 { status: PENDING, currentLevel: 2 }
        Note over AP2: Approver L2 now sees pending item
        AP2->>API: POST /api/tenant/approval-instances/:id/approve
        API->>DB: INSERT ApprovalActionRecord { level: 2, action: APPROVE }
        API->>DB: SELECT WorkflowLevelSnapshot: no level 3 exists
        API->>DB: UPDATE ApprovalInstance SET status = APPROVED, resolvedAt = now()
        API->>AL: log { action: APPROVAL_RESOLVED, outcome: APPROVED }
        API-->>AP2: 200 { status: APPROVED }
    else No more levels
        API->>DB: UPDATE ApprovalInstance SET status = APPROVED
        API->>AL: log { action: APPROVAL_RESOLVED, outcome: APPROVED }
        API-->>AP1: 200 { status: APPROVED }
    end
```

---

## 5. Approval Timeout Cron

```mermaid
sequenceDiagram
    participant CRON as Cron Job (every 15 min)
    participant R as Redis
    participant DB as PostgreSQL
    participant AL as Audit Log

    CRON->>R: SET cron:approval-timeout:lock NX EX 300
    alt Lock not acquired (another instance running)
        CRON->>CRON: Exit immediately
    end

    CRON->>DB: SELECT expired pending instances
    Note over DB: WHERE status='PENDING' AND<br/>current_level_started_at + timeout < NOW()

    loop For each expired instance
        CRON->>DB: SELECT WorkflowLevelSnapshot (by workflowVersionId + currentLevel)
        CRON->>DB: UPDATE instances SET status=... WHERE id=? AND status='PENDING' [CAS]
        alt 0 rows updated (human approved concurrently)
            CRON->>CRON: Skip — human action won
        else Row updated
            alt onTimeoutAction = AUTO_APPROVE
                CRON->>DB: SET status = APPROVED, resolvedAt = now()
                CRON->>AL: log { action: APPROVAL_AUTO_APPROVED, reason: TIMEOUT }
            else onTimeoutAction = ESCALATE AND escalationRoleId has active members
                CRON->>DB: SET currentLevel = currentLevel + 1
                CRON->>AL: log { action: APPROVAL_ESCALATED, from: level, to: level+1 }
            else onTimeoutAction = ESCALATE AND escalationRoleId has NO active members
                CRON->>DB: SET status = REJECTED, resolvedAt = now()
                CRON->>AL: log { action: APPROVAL_AUTO_REJECTED, reason: TIMEOUT_NO_ESCALATION }
            else onTimeoutAction = REJECT
                CRON->>DB: SET status = REJECTED, resolvedAt = now()
                CRON->>AL: log { action: APPROVAL_AUTO_REJECTED, reason: TIMEOUT }
            end
        end
    end

    CRON->>R: DEL cron:approval-timeout:lock
```

---

## 6. Payment Gateway Test Connection

```mermaid
sequenceDiagram
    actor TA as Tenant Admin
    participant B as Browser
    participant GW as Gateway API
    participant CRYPTO as CryptoService
    participant EXT as External Gateway
    participant R as Redis

    TA->>B: Click "Test Connection" button
    B->>GW: POST /api/tenant/payment-gateways/:id/test
    GW->>R: Check rate limit (5/min/tenant)
    alt Rate limit exceeded
        GW-->>B: 429 RATE_LIMIT_EXCEEDED
    end
    GW->>GW: withTenantContext(tenantId, ...)
    GW->>GW: SELECT gateway WHERE id = ?
    GW->>CRYPTO: decryptCredential(apiKeyEncrypted)
    alt Decryption fails
        CRYPTO-->>GW: throw GatewayDecryptError
        GW-->>B: 500 GATEWAY_CREDENTIAL_UNAVAILABLE
    end
    alt provider = JUSPAY
        GW-->>B: 501 NOT_IMPLEMENTED
    else provider = RAZORPAY
        GW->>EXT: GET https://api.razorpay.com/v1/accounts (Bearer apiKey)
        EXT-->>GW: 200 OK
        GW-->>B: 200 { ok: true, message: "Connected successfully" }
    else provider = CASHFREE
        GW->>EXT: POST https://api.cashfree.com/pg/orders (dry-run)
        EXT-->>GW: 200 OK
        GW-->>B: 200 { ok: true, message: "Connected successfully" }
    end
    alt External call fails
        GW-->>B: 200 { ok: false, message: "Connection failed: [reason]" }
    end
```

---

## 7. Tenant Onboarding (Platform Admin)

```mermaid
sequenceDiagram
    actor PA as Platform Admin
    participant B as Browser
    participant PT as Platform Tenants API
    participant DB as PostgreSQL
    participant SES as AWS SES
    participant AL as Audit Log

    PA->>B: Fill tenant creation form (legalName, gstin, contactEmail, planId)
    B->>PT: POST /api/platform/tenants
    PT->>DB: INSERT tenant { status: DRAFT }
    PT->>DB: INSERT default Role "Super Admin" with all permissions
    PT->>DB: INSERT TenantGeneralSettings, TenantSecuritySettings, TenantTaxSettings (defaults)
    PT->>AL: log { action: TENANT_CREATED }
    PT-->>B: 201 { tenantId, status: DRAFT }

    PA->>B: Assign subscription plan
    B->>PT: PATCH /api/platform/tenants/:id/subscription { planId }
    PT->>DB: UPDATE tenant SET subscriptionPlanId = planId
    PT->>DB: INSERT TenantPlanChange { status: APPLIED }
    PT->>AL: log { action: TENANT_PLAN_ASSIGNED }
    PT-->>B: 200

    PA->>B: Send credentials
    B->>PT: POST /api/platform/tenants/:id/send-credentials
    PT->>DB: INSERT User (first tenant admin, mustResetPassword: true)
    PT->>SES: sendActivationEmail(contactEmail, resetLink)
    PT->>DB: UPDATE tenant SET status = PROVISIONING
    PT->>AL: log { action: TENANT_CREDENTIALS_SENT }
    PT-->>B: 200

    Note over B: Tenant Admin receives email, resets password

    B->>B: Tenant admin completes onboarding checklist
    Note over B: GSTIN ✓, first admin ✓, gateway ✓

    PA->>B: Activate tenant
    B->>PT: PATCH /api/platform/tenants/:id/status { status: ACTIVE }
    PT->>DB: UPDATE tenant SET status = ACTIVE
    PT->>AL: log { action: TENANT_ACTIVATED }
    PT-->>B: 200
```

---

## 8. Role Permission Change + Enforcement Lag

```mermaid
sequenceDiagram
    actor ADMIN as Tenant Admin
    actor USER as Role Member (active session)
    participant API as Roles API
    participant DB as PostgreSQL
    participant R as Redis
    participant AL as Audit Log

    Note over USER: User currently has permission "gateways.delete"<br/>Active access token (valid for up to 15 min)

    ADMIN->>API: PUT /api/tenant/roles/:id/permissions { permissions: [...] }
    Note over API: "gateways.delete" removed from permissions list
    API->>DB: DELETE FROM role_permissions WHERE roleId = ? AND module = 'gateways' AND action = 'delete'
    API->>DB: INSERT new permissions
    API->>AL: log { action: ROLE_PERMISSIONS_UPDATED, before: [...], after: [...] }
    API-->>ADMIN: 200 { ...role, permissions: [...] }

    Note over USER: USER still has "gateways.delete" in their JWT for up to 15 min

    alt ADMIN needs immediate revocation
        ADMIN->>API: PATCH /api/tenant/users/:userId/status { status: INACTIVE }
        API->>R: DEL SESSION_KEY(userId)
        API-->>ADMIN: 200
        USER->>API: Any request
        API->>R: GET SESSION_KEY(userId) → NOT FOUND
        API-->>USER: 401 SESSION_INVALIDATED
        USER->>USER: Redirect to /login
    else Wait for natural expiry (up to 15 min)
        USER->>API: POST /api/auth/refresh
        API->>DB: SELECT fresh permissions for user's role
        API->>API: signAccessToken (new permissions WITHOUT gateways.delete)
        API-->>USER: 200 { user, new token }
        Note over USER: "gateways.delete" no longer in token
    end
```
