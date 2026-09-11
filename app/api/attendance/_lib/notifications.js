import Employee from "@/models/Employee";
import Notification from "@/models/Notification";
import { REVERSE_GEOCODE_CACHE_PRECISION, REVERSE_GEOCODE_TTL_MS } from "@/lib/trackingPolicy.mjs";
import { createLogger } from "@/lib/logger.mjs";

const geoLogger = createLogger("reverse-geocode");

const reverseGeocodeCache = new Map();

function cacheKey(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const factor = 10 ** REVERSE_GEOCODE_CACHE_PRECISION;
  return `${Math.round(lat * factor)}:${Math.round(lng * factor)}`;
}

export async function attendanceRecipients(orgId, empId) {
  const employee = await Employee.findOne({ orgId, empId }).select("empId reportingTo").lean();
  const recipients = new Set([empId]);
  if (employee?.reportingTo) {
    const manager = await Employee.findOne({
      _id: employee.reportingTo,
      orgId,
      status: "Active",
    }).select("empId").lean();
    if (manager?.empId) recipients.add(manager.empId);
  }
  return [...recipients];
}

export async function notifyAttendance({ orgId, empId, attendanceId, type, title, message, dedupeKey }) {
  const recipients = await attendanceRecipients(orgId, empId);
  await Promise.all(recipients.map((recipientEmpId) =>
    Notification.updateOne(
      { orgId, recipientEmpId, dedupeKey },
      { $setOnInsert: { orgId, recipientEmpId, employeeEmpId: empId, attendanceId, type, title, message, dedupeKey } },
      { upsert: true },
    ).catch((error) => {
      if (error?.code !== 11000) throw error;
    })
  ));
}

export async function reverseGeocode(latitude, longitude) {
  const key = cacheKey(latitude, longitude);
  const cached = reverseGeocodeCache.get(key);
  if (cached && Date.now() - cached.at < REVERSE_GEOCODE_TTL_MS) {
    geoLogger.debug("Reverse geocode cache hit", { key });
    return cached.value;
  }
  geoLogger.debug("Reverse geocode cache miss", { key });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(latitude),
      lon: String(longitude),
      zoom: "16",
      addressdetails: "0",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        "User-Agent": "TrakagileAttendance/1.0 (location display)",
        "Accept-Language": "en",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      reverseGeocodeCache.set(key, { value: null, at: Date.now() });
      return null;
    }
    const result = await response.json();
    const value = typeof result.display_name === "string" ? result.display_name.slice(0, 500) : null;
    reverseGeocodeCache.set(key, { value, at: Date.now() });
    return value;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
