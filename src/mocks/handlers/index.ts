// MSW handler index — generated from phase1.yaml during Sprint 0.
// Each module exports handlers that cover: success + 400 + 401/403 + 429 paths.
// Import this in src/mocks/browser.ts (client) and src/mocks/server.ts (tests).

export { authHandlers } from "./auth";
export { rolesHandlers } from "./roles";
export { tenantUsersHandlers } from "./tenant-users";
export { gatewaysHandlers } from "./gateways";
export { paymentModesHandlers } from "./payment-modes";
export { settingsHandlers } from "./settings";
export { approvalsHandlers } from "./approvals";
export { auditHandlers } from "./audit";
export { broadcastsHandlers } from "./broadcasts";
export { platformTenantsHandlers } from "./platform-tenants";
export { platformSubscriptionsHandlers } from "./platform-subscriptions";
export { platformUsersHandlers } from "./platform-users";
export { platformSecurityHandlers } from "./platform-security";
export { platformAuditHandlers } from "./platform-audit";
export { platformBroadcastsHandlers } from "./platform-broadcasts";
export { platformSearchHandlers } from "./platform-search";
