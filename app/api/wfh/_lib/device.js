import crypto from "crypto";
import { AttendanceError } from "../../attendance/_lib/attendance";

const hash = (value) => crypto.createHmac("sha256", process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "trakagile-device").update(value).digest("hex");
const text = (value, max = 200) => String(value || "").trim().slice(0, max);

export function deviceFrom(body, request) {
  const deviceId = text(body.deviceId, 200);
  if (deviceId.length < 20) throw new AttendanceError("A valid application Device ID is required.", 409);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return {
    deviceIdHash: hash(deviceId),
    deviceType: text(body.deviceType, 40) || "Unknown",
    platform: text(body.platform, 80) || "Unknown",
    browser: text(body.browser, 80) || "Unknown",
    userAgent: text(request.headers.get("user-agent"), 500),
    ipHash: hash(ip),
  };
}

export function assertBoundDevice(attendance, device) {
  if (!attendance.wfhDevice?.deviceIdHash || attendance.wfhDevice.deviceIdHash !== device.deviceIdHash) {
    throw new AttendanceError("WFH attendance is active on another device. Request a device change.", 423);
  }
}
