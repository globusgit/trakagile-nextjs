import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";

export function locationFrom(body, now = new Date()) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = body.accuracy == null ? undefined : Number(body.accuracy);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be between -90 and 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180.");
  }
  if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) {
    throw new Error("Accuracy must be a positive number.");
  }
  const capturedAt = body.capturedAt ? new Date(body.capturedAt) : now;
  if (Number.isNaN(capturedAt.getTime())) throw new Error("Invalid captured time.");
  return { latitude, longitude, accuracy, capturedAt, receivedAt: now };
}

export function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function getEmployee(orgId, empId) {
  if (!orgId || !empId) throw new Error("Organization and employee are required.");
  const employee = await Employee.findOne({ orgId, empId, status: "Active" });
  if (!employee) throw new Error("Active employee not found.");
  return employee;
}

export async function getActiveAttendance(orgId, empId) {
  return Attendance.findOne({ orgId, empId, attendanceDate: dayKey(), status: "IN" });
}

export function errorResponse(error, fallback = "Attendance request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  const clientError = /required|invalid|between|not found|already|active|complete/i.test(message);
  return Response.json({ message }, { status: clientError ? 400 : 500 });
}
