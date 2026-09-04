import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { verifyMobileToken } from "@/lib/mobileAuth";
import { organizationIdentityFilter } from "@/lib/organization";
import Attendance from "@/models/Attendance";
import AttendancePolicy from "@/models/AttendancePolicy";
import Employee from "@/models/Employee";
import User from "@/models/User";
import Organization from "@/models/Organization";
import { zonedDayKey } from "@/lib/dateTime.mjs";

export const DEFAULT_ATTENDANCE_POLICY = {
  timeZone: "Asia/Kolkata",
  shiftStartMinutes: 570,
  shiftEndMinutes: 1080,
  reminderBeforeMinutes: 15,
  reminderAfterMinutes: [15, 30],
  autoCloseMinutes: 1200,
  overtimeGraceMinutes: 30,
  markOutResponseMinutes: 15,
  officeGeofence: {
    enabled: false,
    name: "Main Office",
    radiusMeters: 300,
    maximumAccuracyMeters: 100,
  },
};

export class AttendanceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AttendanceError";
    this.status = status;
  }
}

export async function requireAttendanceUser(allowedRoles, options = {}) {
  const session = await auth();
  let user = session?.user;

  if (!user) {
    const authorization = (await headers()).get("authorization") || "";
    if (authorization.startsWith("Bearer ")) {
      user = verifyMobileToken(authorization.slice(7));
    }
  }

  if (!user?.empId || !user?.orgId) {
    throw new AttendanceError("Authentication is required.", 401);
  }

  // Revalidate every signed token against the database so deactivation and
  // role changes take effect immediately instead of waiting for token expiry.
  const activeUser = await User.findOne({
    _id: user.id,
    username: user.empId,
    orgId: user.orgId,
    status: "Active",
  }).select("role isFirstLogin +tokenVersion").lean();
  if (!activeUser) {
    throw new AttendanceError("Your account is inactive or unavailable.", 401);
  }
  if (Number(user.tokenVersion || 0) !== Number(activeUser.tokenVersion || 0)) {
    throw new AttendanceError("Your session has expired. Sign in again.", 401);
  }
  if (activeUser.isFirstLogin && !options.allowFirstLogin) {
    throw new AttendanceError("Change your temporary password before continuing.", 403);
  }

  const employee = await Employee.findOne({
    orgId: user.orgId,
    empId: user.empId,
    status: "Active",
  }).select("designation isManager").lean();
  if (!employee) {
    throw new AttendanceError("Your employee profile is inactive or unavailable.", 403);
  }
  const role = employee.designation?.trim().toUpperCase() === "DIRECTOR"
    ? "DIRECTOR"
    : employee.isManager && activeUser.role === "USER"
      ? "MANAGER"
      : activeUser.role;

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new AttendanceError("You are not allowed to perform this action.", 403);
  }

  return {
    userId: user.id,
    empId: user.empId,
    orgId: user.orgId,
    role,
    isFirstLogin: Boolean(activeUser.isFirstLogin),
    tokenVersion: Number(activeUser.tokenVersion || 0),
  };
}

export async function getAttendancePolicy(orgId) {
  const [policy, organization] = await Promise.all([
    AttendancePolicy.findOne({ orgId }).lean(),
    Organization.findOne(organizationIdentityFilter(orgId)).select("timeZone").lean(),
  ]);
  return {
    ...DEFAULT_ATTENDANCE_POLICY,
    ...(policy || {}),
    timeZone: policy?.timeZone || organization?.timeZone || DEFAULT_ATTENDANCE_POLICY.timeZone,
    orgId,
  };
}

export function minutesInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

export function dateAtZonedMinutes(dateKey, minutes, timeZone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const desiredHour = Math.floor(minutes / 60);
  const desiredMinute = minutes % 60;
  let result = new Date(Date.UTC(year, month - 1, day, desiredHour, desiredMinute));

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(result);
    const value = (type) => Number(parts.find((part) => part.type === type)?.value);
    const observed = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
    );
    const desired = Date.UTC(year, month - 1, day, desiredHour, desiredMinute);
    result = new Date(result.getTime() + desired - observed);
  }

  return result;
}

export function attendanceExpectedEndAt(attendance, policy) {
  if (attendance?.overtime?.active && attendance.overtime.expectedEndAt) {
    return new Date(attendance.overtime.expectedEndAt);
  }
  if (attendance?.attendanceType === "FIELD_VISIT" && attendance.expectedWorkEndAt) {
    return new Date(attendance.expectedWorkEndAt);
  }

  const scheduledStart = dateAtZonedMinutes(
    attendance.attendanceDate,
    policy.shiftStartMinutes,
    policy.timeZone,
  );
  const scheduledEnd = dateAtZonedMinutes(
    attendance.attendanceDate,
    policy.shiftEndMinutes,
    policy.timeZone,
  );
  const markIn = new Date(attendance.markIn.time);
  const lateByMs = Math.max(0, markIn.getTime() - scheduledStart.getTime());
  return new Date(scheduledEnd.getTime() + lateByMs);
}

export function locationFrom(body, now = new Date(), options = {}) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = body.accuracy == null ? undefined : Number(body.accuracy);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new AttendanceError("Latitude must be between -90 and 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new AttendanceError("Longitude must be between -180 and 180.");
  }
  if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) {
    throw new AttendanceError("Accuracy must be a positive number.");
  }

  const capturedAt = body.capturedAt ? new Date(body.capturedAt) : now;
  if (Number.isNaN(capturedAt.getTime())) {
    throw new AttendanceError("Invalid captured time.");
  }

  const clockDifference = Math.abs(now.getTime() - capturedAt.getTime());
  const maxClockDifferenceMs = options.maxClockDifferenceMs || 5 * 60 * 1000;
  if (clockDifference > maxClockDifferenceMs) {
    throw new AttendanceError("Location timestamp is outside the accepted tracking window.");
  }

  return { latitude, longitude, accuracy, capturedAt, receivedAt: now };
}

export function movementFrom(body) {
  const speed = body.speed == null ? null : Number(body.speed);
  const heading = body.heading == null ? null : Number(body.heading);

  if (speed != null && (!Number.isFinite(speed) || speed < 0)) {
    throw new AttendanceError("Speed must be a positive number.");
  }
  if (heading != null && (!Number.isFinite(heading) || heading < 0 || heading > 360)) {
    throw new AttendanceError("Heading must be between 0 and 360.");
  }

  return { speed, heading };
}

export function distanceBetween(from, to) {
  if (!from || !to) return 0;

  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const firstLatitude = toRadians(from.latitude);
  const secondLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export function reliableDistance(from, to) {
  const distance = distanceBetween(from, to);
  const fromAccuracy = Number(from?.accuracy) || 0;
  const toAccuracy = Number(to?.accuracy) || 0;
  // GPS errors exist at both ends of a segment. Combining their uncertainty
  // prevents a stationary employee's normal GPS drift from becoming travel.
  const accuracyThreshold = Math.max(
    12,
    Math.hypot(fromAccuracy, toAccuracy) * 1.25,
  );

  return distance >= accuracyThreshold ? Math.round(distance) : 0;
}

export function dayKey(date = new Date(), timeZone = DEFAULT_ATTENDANCE_POLICY.timeZone) {
  return zonedDayKey(date, timeZone);
}

export async function getEmployee(orgId, empId, session) {
  const query = Employee.findOne({ orgId, empId, status: "Active" });
  if (session) query.session(session);
  const employee = await query;
  if (!employee) {
    throw new AttendanceError(
      "Your employee profile is inactive or unavailable. Contact an administrator.",
      403,
    );
  }
  return employee;
}

export async function getActiveAttendance(orgId, empId, session, includeDevice = false) {
  const query = Attendance.findOne({ orgId, empId, status: "IN" }).sort({ "markIn.time": -1 });
  if (includeDevice) query.select("+wfhDevice.deviceIdHash +wfhDevice.ipHash");
  if (session) query.session(session);
  return query;
}

export function errorResponse(error, fallback = "Attendance request failed.") {
  if (error instanceof AttendanceError) {
    return Response.json({ message: error.message }, { status: error.status });
  }

  if (error?.code === 11000) {
    return Response.json(
      { message: "This attendance action was already completed." },
      { status: 409 },
    );
  }

  console.error(fallback, error);
  return Response.json({ message: fallback }, { status: 500 });
}
