// Centralized permissions enum. Use these constants everywhere — never hand-type permission strings.
// Format: MODULE.ACTION — matches JWT claims and RolePermission rows.
// Add new permissions here when a new module is built.

export const PERMISSIONS = {
  // Role Management
  ROLES_VIEW: "roles.view",
  ROLES_CREATE: "roles.create",
  ROLES_EDIT: "roles.edit",
  ROLES_DELETE: "roles.delete",

  // Administrative Users
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_EDIT: "users.edit",
  USERS_TOGGLE_STATUS: "users.toggle_status",

  // Payment Gateways
  GATEWAYS_VIEW: "gateways.view",
  GATEWAYS_CREATE: "gateways.create",
  GATEWAYS_EDIT: "gateways.edit",
  GATEWAYS_DELETE: "gateways.delete",
  GATEWAYS_TEST: "gateways.test",

  // Payment Modes
  PAYMENT_MODES_VIEW: "payment_modes.view",
  PAYMENT_MODES_MANAGE: "payment_modes.manage",

  // General Settings
  SETTINGS_GENERAL_VIEW: "settings.general.view",
  SETTINGS_GENERAL_EDIT: "settings.general.edit",

  // Security Settings
  SETTINGS_SECURITY_VIEW: "settings.security.view",
  SETTINGS_SECURITY_EDIT: "settings.security.edit",

  // Tax Settings
  SETTINGS_TAX_VIEW: "settings.tax.view",
  SETTINGS_TAX_EDIT: "settings.tax.edit",

  // Approval Workflows
  APPROVALS_VIEW: "approvals.view",
  APPROVALS_MANAGE: "approvals.manage",     // create/edit workflows
  APPROVALS_ACTION: "approvals.action",     // approve/reject instances

  // Audit Log
  AUDIT_VIEW: "audit.view",
  AUDIT_EXPORT: "audit.export",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// All valid permission strings — used to validate role permission assignments
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

// Permissions grouped by module — used to render the permissions matrix UI
export const PERMISSION_MODULES: Record<string, Permission[]> = {
  roles: [PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_CREATE, PERMISSIONS.ROLES_EDIT, PERMISSIONS.ROLES_DELETE],
  users: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_TOGGLE_STATUS],
  gateways: [PERMISSIONS.GATEWAYS_VIEW, PERMISSIONS.GATEWAYS_CREATE, PERMISSIONS.GATEWAYS_EDIT, PERMISSIONS.GATEWAYS_DELETE, PERMISSIONS.GATEWAYS_TEST],
  payment_modes: [PERMISSIONS.PAYMENT_MODES_VIEW, PERMISSIONS.PAYMENT_MODES_MANAGE],
  settings_general: [PERMISSIONS.SETTINGS_GENERAL_VIEW, PERMISSIONS.SETTINGS_GENERAL_EDIT],
  settings_security: [PERMISSIONS.SETTINGS_SECURITY_VIEW, PERMISSIONS.SETTINGS_SECURITY_EDIT],
  settings_tax: [PERMISSIONS.SETTINGS_TAX_VIEW, PERMISSIONS.SETTINGS_TAX_EDIT],
  approvals: [PERMISSIONS.APPROVALS_VIEW, PERMISSIONS.APPROVALS_MANAGE, PERMISSIONS.APPROVALS_ACTION],
  audit: [PERMISSIONS.AUDIT_VIEW, PERMISSIONS.AUDIT_EXPORT],
};
