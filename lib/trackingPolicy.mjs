export const TRACKING_INTERVAL_MS = 5 * 60_000;
export const TRACKING_STALE_MS = TRACKING_INTERVAL_MS + 60_000;

export const MAX_ACCURACY_MINUTE_TRIGGER = 100;
export const MAX_ACCURACY_STREAM = 60;
export const UNREALISTIC_SPEED_MPS = 45;
export const GEOFENCE_ACCURACY_THRESHOLD = 100;
export const LOCATION_NAME_REFRESH_DISTANCE = 250;
export const TRAVEL_START_DISTANCE = 100;
export const MOBILE_QUEUE_LIMIT = 500;
export const MOBILE_QUEUE_DROP_OLDEST = true;

export const REVERSE_GEOCODE_TTL_MS = 24 * 60 * 60 * 1000;
export const REVERSE_GEOCODE_CACHE_PRECISION = 4;

export function trackingHealth(employee, now = Date.now()) {
  if (employee.attendanceStatus === "OUT" || employee.trackingStatus === "STOPPED") return "Off duty";
  const captured = new Date(employee.receivedAt || 0).getTime();
  const age = now - captured;
  if (!Number.isFinite(captured) || captured <= 0 || age > 30 * 60_000 || employee.trackingStatus === "OFFLINE") return "Offline";
  if (age > TRACKING_STALE_MS || employee.trackingStatus === "DELAYED") return "Delayed";
  return "On time";
}
