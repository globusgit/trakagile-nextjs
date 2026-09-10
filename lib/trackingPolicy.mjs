export const TRACKING_INTERVAL_MS = 5 * 60_000;
// Allow time for a fresh GPS fix and its upload after the scheduled interval.
export const TRACKING_STALE_MS = TRACKING_INTERVAL_MS + 60_000;

export function trackingHealth(employee, now = Date.now()) {
  if (employee.attendanceStatus === "OUT" || employee.trackingStatus === "STOPPED") return "Off duty";
  const captured = new Date(employee.receivedAt || 0).getTime();
  const age = now - captured;
  if (!Number.isFinite(captured) || captured <= 0 || age > 30 * 60_000 || employee.trackingStatus === "OFFLINE") return "Offline";
  if (age > TRACKING_STALE_MS || employee.trackingStatus === "DELAYED") return "Delayed";
  return "On time";
}
