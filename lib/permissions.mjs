export const ROLES = Object.freeze({
  USER: "USER",
  MANAGER: "MANAGER",
  ACCOUNTANT: "ACCOUNTANT",
  HR: "HR",
  ADMIN: "ADMIN",
  DIRECTOR: "DIRECTOR",
});

export const PERMISSIONS = Object.freeze({
  ORGANIZATION_READ_ALL: "organization:read-all",
  ORGANIZATION_SETTINGS_MANAGE: "organization:manage-settings",
  EMPLOYEE_READ_TEAM: "employee:read-team",
  EMPLOYEE_SEARCH: "employee:search",
  EMPLOYEE_MANAGE: "employee:manage",
  USER_MANAGE: "user:manage",
  DASHBOARD_TEAM_READ: "dashboard:read-team",
  ATTENDANCE_TEAM_READ: "attendance:read-team",
  ATTENDANCE_LIVE_READ: "attendance:read-live",
  ATTENDANCE_GROUP_READ: "attendance:read-group",
  ATTENDANCE_GROUP_CREATE: "attendance:create-group",
  ATTENDANCE_POLICY_MANAGE: "attendance:manage-policy",
  ATTENDANCE_REMINDERS_RUN: "attendance:run-reminders",
  ATTENDANCE_REPORT_READ_ALL: "attendance-report:read-all",
  HOLIDAY_MANAGE: "holiday:manage",
  LEAVE_BALANCE_MANAGE: "leave:manage-balances",
  WFH_REVIEW: "wfh:review",
  WFH_READ_ALL: "wfh:read-all",
  FIELD_TRIP_READ_ALL: "field-trip:read-all",
  SYSTEM_LIST_MANAGE: "system-list:manage",
  TASK_READ_ALL: "task:read-all",
  TASK_MANAGE: "task:manage",
  LEAVE_REVIEW: "leave:review",
  DOCUMENT_READ_ALL: "document:read-all",
  DOCUMENT_UPLOAD_FOR_OTHERS: "document:upload-for-others",
  DOCUMENT_DELETE_ANY: "document:delete-any",
  AUDIT_READ: "audit:read",
});

const rolePermissions = Object.freeze({
  [ROLES.USER]: [],
  [ROLES.ACCOUNTANT]: [],
  [ROLES.MANAGER]: [
    PERMISSIONS.EMPLOYEE_READ_TEAM,
    PERMISSIONS.EMPLOYEE_SEARCH,
    PERMISSIONS.DASHBOARD_TEAM_READ,
    PERMISSIONS.ATTENDANCE_TEAM_READ,
    PERMISSIONS.ATTENDANCE_LIVE_READ,
    PERMISSIONS.ATTENDANCE_GROUP_READ,
    PERMISSIONS.ATTENDANCE_GROUP_CREATE,
    PERMISSIONS.HOLIDAY_MANAGE,
    PERMISSIONS.TASK_MANAGE,
    PERMISSIONS.LEAVE_REVIEW,
    PERMISSIONS.WFH_REVIEW,
  ],
  [ROLES.HR]: [
    PERMISSIONS.ORGANIZATION_READ_ALL,
    PERMISSIONS.EMPLOYEE_READ_TEAM,
    PERMISSIONS.EMPLOYEE_SEARCH,
    PERMISSIONS.ATTENDANCE_GROUP_READ,
    PERMISSIONS.TASK_READ_ALL,
    PERMISSIONS.TASK_MANAGE,
  ],
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.DIRECTOR]: Object.values(PERMISSIONS),
});

export function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

export function hasPermission(role, permission) {
  return Boolean(rolePermissions[normalizeRole(role)]?.includes(permission));
}

export function rolesForPermission(permission) {
  return Object.keys(rolePermissions).filter((role) => hasPermission(role, permission));
}

export function permissionMatrix() {
  return Object.fromEntries(
    Object.entries(rolePermissions).map(([role, permissions]) => [role, [...permissions]]),
  );
}
