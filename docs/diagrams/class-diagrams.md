# Class Diagrams
## Matrix Emart Admin Platform — Phase 1

---

## 1. Domain Model

```mermaid
classDiagram
    class Tenant {
        +String id
        +String legalName
        +String? gstin
        +String contactEmail
        +TenantStatus status
        +String? subscriptionPlanId
        +DateTime createdAt
    }

    class User {
        +String id
        +String? tenantId
        +String email
        +String name
        +String? roleId
        +UserStatus status
        +Boolean mustResetPassword
        +Boolean twoFactorEnabled
        +Boolean deletedByDpdp
        +Int failedLoginCount
        +DateTime? lockoutUntil
    }

    class Role {
        +String id
        +String tenantId
        +String name
        +UserStatus status
        +RolePermission[] permissions
    }

    class RolePermission {
        +String id
        +String roleId
        +String module
        +String action
        +toDotString() String
    }

    class PaymentGateway {
        +String id
        +String tenantId
        +String name
        +GatewayProvider provider
        +String apiKeyEncrypted
        +String apiSecretEncrypted
        +GatewayMode mode
        +GatewayStatus status
        +Int routingPriority
    }

    class PaymentMode {
        +String id
        +String tenantId
        +String name
        +PaymentModeCode code
        +UserStatus status
    }

    class ApprovalWorkflow {
        +String id
        +String tenantId
        +String name
        +String triggerEvent
        +WorkflowStatus status
        +WorkflowLevel[] levels
    }

    class WorkflowLevel {
        +String id
        +String workflowId
        +Int levelNumber
        +String approverRoleId
        +Int timeoutHours
        +OnTimeoutAction onTimeoutAction
        +String? escalationRoleId
    }

    class WorkflowVersion {
        +String id
        +String workflowId
        +Int versionNumber
        +DateTime activatedAt
        +WorkflowLevelSnapshot[] snapshots
    }

    class WorkflowLevelSnapshot {
        +String id
        +String versionId
        +Int levelNumber
        +String approverRoleId
        +Int timeoutHours
        +OnTimeoutAction onTimeoutAction
        +String? escalationRoleId
    }

    class ApprovalInstance {
        +String id
        +String workflowId
        +String workflowVersionId
        +String entityType
        +String entityId
        +Int currentLevel
        +ApprovalInstanceStatus status
        +String initiatedBy
        +DateTime initiatedAt
        +DateTime? resolvedAt
    }

    class AuditLog {
        +String id
        +String? tenantId
        +String userId
        +String action
        +String entityType
        +String entityId
        +Json? beforeState
        +Json? afterState
        +String? impersonatedBy
        +DateTime timestamp
    }

    class SubscriptionPlan {
        +String id
        +String name
        +Int maxUsers
        +Int maxGateways
        +String[] modulesAllowed
        +Boolean apiAccess
        +SupportTier supportTier
        +Int approvalWorkflowLevels
    }

    Tenant "1" --> "0..*" User : has
    Tenant "1" --> "0..*" Role : has
    Tenant "1" --> "0..*" PaymentGateway : has
    Tenant "1" --> "0..*" PaymentMode : has
    Tenant "1" --> "0..*" ApprovalWorkflow : has
    Tenant "0..*" --> "1" SubscriptionPlan : subscribes to
    User "0..*" --> "0..1" Role : assigned
    Role "1" --> "0..*" RolePermission : has
    ApprovalWorkflow "1" --> "1..*" WorkflowLevel : has
    ApprovalWorkflow "1" --> "0..*" WorkflowVersion : versioned by
    WorkflowVersion "1" --> "1..*" WorkflowLevelSnapshot : snapshots
    ApprovalWorkflow "1" --> "0..*" ApprovalInstance : instances
    ApprovalInstance "0..*" --> "1" WorkflowVersion : pinned to
```

---

## 2. Auth & Security Layer

```mermaid
classDiagram
    class AccessTokenPayload {
        +String userId
        +String role
        +String? tenantId
        +String[] permissions
        +String? impersonatedBy
        +Number iat
        +Number exp
    }

    class JwtService {
        +signAccessToken(payload: AccessTokenPayload) String
        +signRefreshToken(userId: String) String
        +verifyAccessToken(token: String) AccessTokenPayload
        +verifyRefreshToken(token: String) RefreshPayload
        +isImpersonationToken(payload: AccessTokenPayload) Boolean
    }

    class SessionRegistry {
        -RedisClient redis
        +register(userId: String, sessionId: String) void
        +validate(userId: String, sessionId: String) Boolean
        +invalidate(userId: String) void
        -SESSION_KEY(userId: String) String
    }

    class PasswordPolicyEngine {
        +validateComplexity(password: String) ValidationResult
        +checkExpiry(passwordChangedAt: DateTime, expiryDays: Int) Boolean
        +hashPassword(plaintext: String) String
        +verifyPassword(plaintext: String, hash: String) Boolean
        +isRecentlyUsed(hash: String, history: String[]) Boolean
    }

    class RateLimiter {
        -Ratelimit loginLimiter
        -Ratelimit refreshLimiter
        -Ratelimit gatewayTestLimiter
        +checkLogin(ip: String) RateLimitResult
        +checkRefresh(ip: String) RateLimitResult
        +checkGatewayTest(tenantId: String) RateLimitResult
    }

    class GatewayDecryptError {
        +String code
        +code: MISSING_CIPHERTEXT | DECRYPT_FAILED | INVALID_FORMAT
    }

    class CryptoService {
        +encryptCredential(plaintext: String) String
        +decryptCredential(ciphertext: String?) String
        -generateIV() Buffer
    }

    JwtService ..> AccessTokenPayload : creates/reads
    SessionRegistry --> JwtService : validates session
    CryptoService ..> GatewayDecryptError : throws
```

---

## 3. API Layer (Route Handlers)

```mermaid
classDiagram
    class AuthHandler {
        +POST_login(req: Request) Response
        +POST_refresh(req: Request) Response
        +POST_logout(req: Request) Response
        +POST_passwordResetRequest(req: Request) Response
        +POST_passwordReset(req: Request) Response
        +POST_passwordChange(req: Request) Response
    }

    class TenantRolesHandler {
        +GET_list(tenantId: String) Response
        +POST_create(tenantId: String, body: CreateRoleDto) Response
        +GET_one(tenantId: String, roleId: String) Response
        +PUT_update(tenantId: String, roleId: String, body: UpdateRoleDto) Response
        +DELETE_one(tenantId: String, roleId: String) Response
        +PUT_permissions(tenantId: String, roleId: String, permissions: String[]) Response
    }

    class GatewayHandler {
        +GET_list(tenantId: String) Response
        +POST_create(tenantId: String, body: CreateGatewayDto) Response
        +GET_one(tenantId: String, id: String) Response
        +PUT_update(tenantId: String, id: String, body: UpdateGatewayDto) Response
        +DELETE_one(tenantId: String, id: String) Response
        +POST_testConnection(tenantId: String, id: String) Response
        +PATCH_status(tenantId: String, id: String, status: String) Response
    }

    class ApprovalsHandler {
        +GET_workflows(tenantId: String) Response
        +POST_createWorkflow(tenantId: String, body: CreateWorkflowDto) Response
        +PUT_updateWorkflow(tenantId: String, id: String, body: UpdateWorkflowDto) Response
        +DELETE_workflow(tenantId: String, id: String) Response
        +GET_instances(tenantId: String, filter: InstanceFilter) Response
        +POST_approve(tenantId: String, instanceId: String, notes: String) Response
        +POST_reject(tenantId: String, instanceId: String, notes: String) Response
    }

    class PlatformTenantsHandler {
        +GET_list(filter: TenantFilter) Response
        +POST_create(body: CreateTenantDto) Response
        +GET_one(tenantId: String) Response
        +PATCH_status(tenantId: String, status: TenantStatus) Response
        +POST_impersonate(tenantId: String) Response
    }

    class Middleware {
        +verifyJWT(req: Request) AccessTokenPayload
        +enforceRouteGuard(payload: AccessTokenPayload, path: String) void
        +injectHeaders(payload: AccessTokenPayload, req: Request) void
        +checkTenantIdNotNull(req: Request) void
    }

    Middleware --> AuthHandler : guards
    Middleware --> TenantRolesHandler : guards
    Middleware --> GatewayHandler : guards
    Middleware --> ApprovalsHandler : guards
    Middleware --> PlatformTenantsHandler : guards
```

---

## 4. Service Layer

```mermaid
classDiagram
    class TenantContextService {
        +withTenantContext(tenantId: String, fn: Function) Promise
        -setRlsVariable(tx: Transaction, tenantId: String) void
    }

    class AuditService {
        +log(entry: AuditEntry) void
        +logImpersonated(entry: AuditEntry, impersonatedBy: String) void
        +list(tenantId: String?, filter: AuditFilter) CursorPage
        +export(tenantId: String?, filter: AuditFilter, format: String) Buffer
    }

    class ApprovalTimeoutJob {
        -RedisClient redis
        -LOCK_KEY: String
        -LOCK_TTL: Int
        +run() Promise
        -acquireLock() Boolean
        -releaseLock() void
        -processExpiredInstances() void
        -autoReject(instance: ApprovalInstance) void
        -escalate(instance: ApprovalInstance, snapshot: WorkflowLevelSnapshot) void
    }

    class EmailService {
        +sendActivationEmail(to: String, resetLink: String) void
        +sendPasswordResetEmail(to: String, resetLink: String) void
        +sendBroadcast(to: String[], subject: String, body: String) void
    }

    class StartupCheckService {
        +runStartupChecks() void
        -checkRequiredEnvVars() void
        -checkEncryptionKeyLength() void
    }

    TenantContextService ..> AuditService : used by
    ApprovalTimeoutJob ..> AuditService : writes audit
    ApprovalTimeoutJob ..> TenantContextService : wraps queries
```

---

## 5. Frontend — React Component Hierarchy

```mermaid
classDiagram
    class AppLayout {
        +user: AuthUser
        +render() JSX
    }

    class PermissionGate {
        +permission: String
        +fallback?: JSX
        +render() JSX | null
    }

    class useAuth {
        +user: AuthUser | null
        +isLoading: Boolean
        +isAuthenticated: Boolean
        +requiresPasswordReset: Boolean
        +hasPermission(permission: String) Boolean
        +logout() void
    }

    class useTenantQuery {
        +tenantId: String
        +queryKey: unknown[]
        +queryFn: Function
        +returns: UseQueryResult
    }

    class useTenantMutation {
        +tenantId: String
        +invalidateKeys: unknown[][]
        +returns: UseMutationResult
    }

    class TenantRolesPage {
        +roles: Role[]
        +onCreate() void
        +onDelete(roleId: String) void
        +onToggleStatus(roleId: String) void
    }

    class PermissionsMatrix {
        +roleId: String
        +permissions: String[]
        +onChange(permissions: String[]) void
        +render() JSX
    }

    class GatewaysPage {
        +gateways: PaymentGateway[]
        +planLimit: Int
        +onTestConnection(id: String) void
        +render() JSX
    }

    class AuditLogPage {
        +logs: AuditLog[]
        +nextCursor: String?
        +onExport(format: String) void
        +render() JSX
    }

    class AuditDiffViewer {
        +before: Json
        +after: Json
        +render() JSX
    }

    class ImpersonationBanner {
        +tenantName: String
        +onExit() void
        +render() JSX
    }

    AppLayout --> useAuth : reads
    AppLayout --> PermissionGate : wraps routes
    TenantRolesPage --> PermissionsMatrix : child
    TenantRolesPage --> useTenantQuery : data
    GatewaysPage --> useTenantQuery : data
    AuditLogPage --> AuditDiffViewer : child
    AuditLogPage --> useTenantQuery : cursor paged
    useAuth --> useTenantQuery : provides tenantId
    useTenantMutation --> useTenantQuery : invalidates
```

---

## 6. Enumerations

```mermaid
classDiagram
    class TenantStatus {
        <<enumeration>>
        DRAFT
        PROVISIONING
        ACTIVE
        SUSPENDED
        TERMINATED
    }

    class GatewayProvider {
        <<enumeration>>
        RAZORPAY
        CASHFREE
        JUSPAY
    }

    class ApprovalInstanceStatus {
        <<enumeration>>
        PENDING
        APPROVED
        REJECTED
        TIMED_OUT
        REVISION_REQUESTED
    }

    class OnTimeoutAction {
        <<enumeration>>
        AUTO_APPROVE
        ESCALATE
        REJECT
    }

    class ApprovalAction {
        <<enumeration>>
        APPROVE
        REJECT
        REQUEST_REVISION
        TIMEOUT_AUTO_APPROVE
        TIMEOUT_REJECT
        TIMEOUT_ESCALATE
    }

    class BroadcastScope {
        <<enumeration>>
        SINGLE
        SELECTION
        ALL
    }

    class DpdpRequestType {
        <<enumeration>>
        ERASURE
        ACCESS
    }
```
