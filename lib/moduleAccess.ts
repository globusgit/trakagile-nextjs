/**
 * Central switchboard for which sections of the app are turned on, and for
 * which roles.
 *
 * Nothing about a module's pages/API routes is deleted when it is turned
 * off here — flipping `enabled` back to `true` (or adding a role to
 * `roles`) brings it straight back, no other file needs to change.
 *
 * This file is the single source of truth used by:
 *  - SideNav.tsx            -> which links show in the sidebar
 *  - ModuleAccessGuard.tsx  -> blocks *direct URL* access to a disabled
 *                              module (typing/bookmarking the URL bypasses
 *                              a hidden sidebar link, so hiding the link
 *                              alone is not enough)
 *  - the login page         -> where to land the user after sign-in, now
 *                              that "Dashboard" is not guaranteed to be
 *                              enabled
 */

export type ModuleKey =
  | "dashboard"
  | "attendance"
  | "attendance-calendar"
  | "history"
  | "tasks"
  | "notifications"
  | "field-trips"
  | "work-from-home"
  | "leaves"
  | "holidays"
  | "reports"
  | "documents"
  | "live-tracking"
  | "employees"
  | "task-dashboard"
  | "audit-logs"
  | "settings";

export interface ModuleConfig {
  key: ModuleKey;
  /** Route prefix this module owns, e.g. "/attendance/history" */
  href: string;
  /** Master on/off switch. Flip to `true` to bring a module back. */
  enabled: boolean;
  /** "all" = every signed-in role, otherwise an explicit role list. */
  roles: "all" | string[];
}

// NOTE: "Associate HR" is currently stored as a `designation` on the
// Employee record, not as its own value in the `role` enum (see
// lib/permissions.mjs). Both regular HR and "Associate HR" employees are
// created with role "HR", so gating by role: ["HR", ...] already covers
// both. If Associate HR is ever split into its own role string, just add
// it to the `roles` arrays below.
export const MODULES: ModuleConfig[] = [
  { key: "dashboard", href: "/dashboard", enabled: false, roles: "all" },
  { key: "attendance", href: "/attendance", enabled: false, roles: "all" },
  { key: "attendance-calendar", href: "/attendance/calendar", enabled: false, roles: "all" },
  { key: "history", href: "/attendance/history", enabled: true, roles: "all" },
  { key: "tasks", href: "/tasks", enabled: true, roles: "all" },
  { key: "notifications", href: "/notifications", enabled: true, roles: "all" },
  { key: "field-trips", href: "/field-trips", enabled: false, roles: "all" },
  { key: "work-from-home", href: "/work-from-home", enabled: false, roles: "all" },
  { key: "leaves", href: "/leaves", enabled: false, roles: "all" },
  { key: "holidays", href: "/holidays", enabled: false, roles: "all" },
  { key: "reports", href: "/reports", enabled: false, roles: "all" },
  { key: "documents", href: "/documents", enabled: false, roles: "all" },
  { key: "live-tracking", href: "/live-tracking", enabled: false, roles: ["MANAGER", "ADMIN", "DIRECTOR"] },
  { key: "employees", href: "/employees", enabled: true, roles: ["HR", "ADMIN", "DIRECTOR"] },
  // Director-only overview: for each employee, how many tasks THIS director
  // has assigned them, and how many are completed/pending. Strictly
  // account-scoped in the API (see app/api/tasks/dashboard/route.js) - each
  // director only ever sees their own assignments, never another
  // director's.
  { key: "task-dashboard", href: "/task-dashboard", enabled: true, roles: ["DIRECTOR"] },
  { key: "audit-logs", href: "/audit-logs", enabled: false, roles: ["ADMIN", "DIRECTOR"] },
  { key: "settings", href: "/settings", enabled: false, roles: ["ADMIN", "DIRECTOR"] },
];

/** Longest href first, so "/attendance/history" is checked before "/attendance". */
const MODULES_BY_SPECIFICITY = [...MODULES].sort((a, b) => b.href.length - a.href.length);

export function normalizeRole(role?: string | null) {
  return String(role || "").trim().toUpperCase();
}

export function isModuleEnabledForRole(moduleConfig: ModuleConfig, role?: string | null) {
  if (!moduleConfig.enabled) return false;
  if (moduleConfig.roles === "all") return true;
  return moduleConfig.roles.includes(normalizeRole(role));
}

/**
 * Given a pathname (e.g. "/attendance/history"), find the module that owns
 * it. Returns undefined for paths that aren't part of any module (e.g.
 * "/change-password") — those are left alone by the guard.
 */
export function findModuleForPath(pathname: string): ModuleConfig | undefined {
  return MODULES_BY_SPECIFICITY.find(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`),
  );
}

export function isPathAllowed(pathname: string, role?: string | null) {
  const moduleConfig = findModuleForPath(pathname);
  if (!moduleConfig) return true;
  return isModuleEnabledForRole(moduleConfig, role);
}

/** First enabled module a role is allowed to land on, in sidebar order. */
export function getDefaultHrefForRole(role?: string | null) {
  const landingOrder: ModuleKey[] = ["history", "tasks", "notifications", "employees"];
  for (const key of landingOrder) {
    const moduleConfig = MODULES.find((m) => m.key === key);
    if (moduleConfig && isModuleEnabledForRole(moduleConfig, role)) return moduleConfig.href;
  }
  // Fallback so the app never dead-ends even if every module above is
  // switched off for some role.
  return "/notifications";
}

/** Path used site-wide as "home" (post-login redirect, PageHeader back-link). */
export const DEFAULT_LANDING_PATH = "/attendance/history";