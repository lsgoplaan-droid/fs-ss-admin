# Business Requirements Document (BRD)
## Matrix Emart — Multi-Tenant Marketplace Governance Admin Platform
**Version:** 1.0 | **Date:** 2026-04-17 | **Status:** APPROVED

---

## 1. Executive Summary

Matrix Emart requires a centralized governance platform to manage multi-vendor marketplace operations across multiple enterprise retail tenants. The platform delivers two distinct admin layers in a single web application: a **Platform Admin** layer for super-admin control of tenants, plans, and platform security; and a **Tenant Admin** layer for each marketplace operator to configure payment gateways, roles, approval workflows, and compliance settings.

The immediate client is a committed paying customer (Indian enterprise retailer) transitioning to a multi-vendor model. The platform is architected to scale to 50+ tenants without re-deployment, establishing a first-mover moat in India-native marketplace governance.

---

## 2. Business Context

### 2.1 Market Opportunity

Indian enterprise retailers are transitioning to multi-vendor marketplace models. No India-native multi-tenant marketplace governance platform currently exists (confirmed April 2026). Western competitors (Mirakl, CS-Cart, Yo!Kart, Spree) lack India compliance — no GSTIN, Juspay aggregator, or GST/TCS configuration. The go-to-market window is estimated at 12–18 months.

### 2.2 Current State (Status Quo)

The paying customer currently operates with:
- Spreadsheet-based vendor tracking
- Ad-hoc, undocumented role management
- No structured approval workflows
- No centralized audit trail
- Hardcoded payment gateway configuration
- No subscription/entitlement layer — onboarding tenant #2 requires a full custom deployment

### 2.3 Strategic Objectives

1. Ship Phase 1 governance platform for the committed paying customer
2. Build the multi-tenancy infrastructure so tenant #2 and #3 onboard without custom deployments
3. Establish India compliance stack (GSTIN, Razorpay/Cashfree/Juspay, GST/TCS) as a competitive moat
4. Lay the DPDP-ready schema foundation for Phase 2 compliance sprint

---

## 3. Stakeholders

| Stakeholder | Role | Interest |
|-------------|------|----------|
| Matrix Emart (Paying Customer) | Primary user | Tenant Admin — gateway config, roles, approvals, audit |
| Platform Operator | Platform Admin | Tenant lifecycle, subscription management, security oversight |
| Marketplace Operators (future tenants) | Tenant Admins | Self-service configuration of their marketplace instance |
| Head of Marketplace Operations | Primary Tenant Admin user | Day-to-day governance of vendor and payment operations |
| Compliance / Finance team | Tenant Admin — Tax settings | GSTIN, invoice config, GST/TCS |
| Development Team | Builders | API contracts, frontend, backend |

---

## 4. Business Requirements

### 4.1 Tenant Admin — Core Requirements

| ID | Requirement | Priority | Module |
|----|-------------|----------|--------|
| BR-01 | System must support role-based access control with configurable permission matrices per tenant | Must Have | Roles |
| BR-02 | Tenant must be able to invite, manage, and deactivate administrative users | Must Have | Users |
| BR-03 | System must support configuring multiple payment gateways (Razorpay, Cashfree, Juspay) with routing priority | Must Have | Gateways |
| BR-04 | System must support payment mode configuration (UPI, Card, COD, Wallet, Net Banking) linked to gateways | Must Have | Payment Modes |
| BR-05 | System must support multi-level approval workflows (up to 5 levels) for configurable trigger events | Must Have | Approvals |
| BR-06 | System must maintain an immutable, append-only audit log of all configuration actions | Must Have | Audit |
| BR-07 | System must enforce single concurrent session per user, with configurable security policies | Must Have | Auth/Security |
| BR-08 | System must support GSTIN validation and invoice template configuration | Must Have | Tax |
| BR-09 | System must support general settings: company info, logo/favicon, SEO, social links | Should Have | Settings |
| BR-10 | Approval workflows must continue under original rules for in-flight approvals when workflow is edited | Must Have | Approvals |

### 4.2 Platform Admin — Core Requirements

| ID | Requirement | Priority | Module |
|----|-------------|----------|--------|
| BR-11 | Platform admin must be able to create, provision, suspend, and terminate tenants | Must Have | Tenant Mgmt |
| BR-12 | System must enforce tenant lifecycle states: Draft → Provisioning → Active → Suspended → Terminated | Must Have | Tenant Mgmt |
| BR-13 | Platform admin must be able to assign and change subscription plans with immediate or deferred effect | Must Have | Subscriptions |
| BR-14 | System must display per-tenant health metrics (active users, API calls, error rate, usage vs. plan limits) | Should Have | Health Dashboard |
| BR-15 | Platform admin must be able to impersonate any tenant admin for support (30-min scoped session, audited) | Must Have | Impersonation |
| BR-16 | Platform admin must be able to send announcements and maintenance notices to one, many, or all tenants | Should Have | Broadcasts |
| BR-17 | Platform admin must be able to override feature flags per tenant outside their subscription plan | Should Have | Feature Flags |
| BR-18 | System must maintain platform-level audit log (tenant lifecycle, impersonation, subscription changes) | Must Have | Platform Audit |
| BR-19 | System must support global search across tenants by name, GSTIN, email, or tenant ID | Must Have | Search |
| BR-20 | Platform security: 2FA mandatory for all platform admins, configurable IP whitelisting | Must Have | Platform Security |

### 4.3 India-Specific Requirements

| ID | Requirement |
|----|-------------|
| BR-21 | GSTIN validation: 15-character alphanumeric, mod-36 checksum, state code + PAN encoded |
| BR-22 | Payment gateway support: Razorpay (direct), Cashfree (direct), Juspay (aggregator) |
| BR-23 | Aggregator mode: single Juspay credential entry; sub-gateway routing managed in Juspay dashboard |
| BR-24 | Tax configuration: GST type (Regular/Composition), invoice prefix/numbering, digital signature |
| BR-25 | Currency: INR default across all plans, transactions, and pricing |

### 4.4 Security & Compliance Requirements

| ID | Requirement |
|----|-------------|
| BR-26 | Payment gateway API keys and secrets must be encrypted at rest (AES-256-GCM) |
| BR-27 | Password policy: 90-day expiry default, complexity rules, account lockout after 5 failed attempts |
| BR-28 | All actions taken under impersonation must be logged with `impersonated_by` field in audit log |
| BR-29 | System must be DPDP-ready (schema stubs for data subject requests and PII field registry) |
| BR-30 | Audit log must be immutable — PostgreSQL RLS denies UPDATE/DELETE on audit_logs table |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Login < 300ms p99; Audit log query < 500ms p99 (cursor pagination); Tenant list < 1s p99 |
| NFR-02 | Availability | 99.9% uptime SLA (Phase 1, single customer) |
| NFR-03 | Scalability | Architecture must support 50+ tenants without re-deployment (RLS + tenant_id partitioning) |
| NFR-04 | Security | HTTP-only cookies for token storage; no secrets in URL params or localStorage |
| NFR-05 | Security | Rate limiting: login 10/min/IP, token refresh 30/min/IP, gateway test 5/min/tenant |
| NFR-06 | Observability | All errors logged with structured JSON; no key material in logs |
| NFR-07 | Localization | Phase 1: English only |
| NFR-08 | Browser support | Chrome 120+, Firefox 120+, Edge 120+, Safari 17+ |
| NFR-09 | Accessibility | WCAG 2.1 AA (keyboard navigation, ARIA labels on all interactive elements) |
| NFR-10 | Data residency | Database in India region (AWS ap-south-1 or equivalent) |

---

## 6. Scope

### 6.1 In Scope — Phase 1

**Tenant Admin (8 modules):**
1. Authentication + Password Policy
2. Role Management (RBAC, permissions matrix)
3. Administrative Users
4. Payment Gateway Setup + Payment Modes
5. General Settings (company info, branding, SEO)
6. Security Settings
7. Tax Management (GSTIN, invoice config)
8. Workflow & Approvals
9. Audit & Monitoring

**Platform Admin (7 modules):**
1. Tenant Management (lifecycle, onboarding checklist, feature flags)
2. Tenant Health Dashboard
3. Tenant Communication (broadcasts)
4. Subscription Plans & Entitlements
5. Platform Users Management
6. Platform Security Settings
7. Platform Audit Log + Global Search
8. Switch Tenant / Impersonation

### 6.2 Explicitly Out of Scope — Phase 1

- DPDP compliance UI (erasure workflows, consent management, right-to-access portal) → Phase 2
- Developer Settings / API Keys UI → Phase 2
- Webhook infrastructure → Phase 1.5
- Email notification template editor → Phase 2
- Localization / i18n → Phase 2
- Usage-based billing → Phase 2
- Mobile app → Phase 2+
- System Health Monitoring (tenant admin) → requires infrastructure decision
- Juspay full integration → Phase 1.5

---

## 7. Constraints

| Constraint | Detail |
|------------|--------|
| Technology | Next.js 15 App Router, TypeScript, PostgreSQL, Upstash Redis |
| India compliance | GSTIN, Razorpay/Cashfree/Juspay payment ecosystem |
| Deployment | Vercel or AWS Amplify |
| Timeline | Phase 1 target: ~2026-09-04 |
| API-first | OpenAPI 3.1 spec must be complete before frontend or backend sprint begins |

---

## 8. Assumptions

1. A dedicated backend lead is available for Sprint 1 onwards
2. Razorpay and Cashfree sandbox credentials are obtainable before Step 5
3. The customer accepts in-app-only notifications for Phase 1 (no email notifications on approval events)
4. Access token TTL of 15 minutes is acceptable; permission changes take effect on next refresh
5. Soft-delete only for Tenant Admin users (no hard delete in Phase 1)
6. Single concurrent session per user is a hard requirement

---

## 9. Success Criteria

| Scenario | Target |
|----------|--------|
| Platform admin creates tenant + assigns plan + sends credentials | < 3 minutes |
| Tenant admin configures Razorpay (test → live) without documentation | No support needed |
| Role with 10-module permissions matrix created | < 5 minutes |
| 3-level approval workflow configured (Manager → Head → Director) | < 10 minutes |
| Audit log searched + exported to CSV | < 30 seconds |
| First-login reset, 90-day password expiry, concurrent session block | Work without additional config |

---

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| API contracts not available by Week 2 | Medium | High | MSW mock layer against OpenAPI spec; integration buffer |
| Permission change latency (15-min refresh window) | Medium | Medium | Admin can deactivate user for immediate enforcement; customer must accept window |
| RLS misconfiguration — cross-tenant data leak | Low | Critical | `withTenantContext()` wraps every tenant query; integration test with real PostgreSQL |
| Approval timeout cron concurrent run during deploy | Low | High | Redis SETNX lock; TTL safety net; CAS UPDATE guard |
| Gateway credential null decrypt on misconfigured staging | Low | High | Startup process.exit(1) + `decryptCredential()` throws GatewayDecryptError |
| Juspay sandbox not available for Phase 1 | Medium | Low | Juspay deferred to Phase 1.5; 501 stub in API |
