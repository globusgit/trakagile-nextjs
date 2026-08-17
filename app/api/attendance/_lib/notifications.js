import Employee from "@/models/Employee";
import Notification from "@/models/Notification";

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
    if (!response.ok) return null;
    const result = await response.json();
    return typeof result.display_name === "string" ? result.display_name.slice(0, 500) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
