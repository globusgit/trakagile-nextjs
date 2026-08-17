const FIVE_MINUTES = 5 * 60_000;
const ACCEPTABLE_GPS_ACCURACY_METERS = 100;

export function workStatusFor(attendance, location, now = new Date()) {
  if (!attendance || attendance.status !== "IN") {
    return { state: "STOPPED", confidence: "NONE", label: "Not working", reason: "Attendance is not active." };
  }

  if (attendance.attendanceType === "WORK_FROM_HOME") {
    if (attendance.wfh?.breakStartedAt) {
      return { state: "ON_BREAK", confidence: "HIGH", label: "On break", reason: "Break is active on the registered WFH device." };
    }
    const lastSeen = attendance.wfhDevice?.lastSeenAt;
    const freshDevice = lastSeen && now.getTime() - new Date(lastSeen).getTime() <= FIVE_MINUTES;
    return freshDevice
      ? { state: "VERIFIED", confidence: "HIGH", label: "Verified working", reason: "Registered WFH device was verified within five minutes." }
      : { state: "NEEDS_ATTENTION", confidence: "LOW", label: "Device check overdue", reason: "Registered WFH device has not checked in for more than five minutes." };
  }

  const point = location || attendance.lastKnownLocation;
  const receivedAt = location?.receivedAt || attendance.lastLocationReceivedAt || point?.receivedAt;
  if (!point || !receivedAt || now.getTime() - new Date(receivedAt).getTime() > FIVE_MINUTES) {
    return { state: "NEEDS_ATTENTION", confidence: "LOW", label: "Location overdue", reason: "No fresh GPS update was received within five minutes." };
  }
  if (!Number.isFinite(point.accuracy) || point.accuracy > ACCEPTABLE_GPS_ACCURACY_METERS) {
    return { state: "NEEDS_ATTENTION", confidence: "MEDIUM", label: "Low GPS accuracy", reason: `Latest GPS accuracy is ${Math.round(point.accuracy || 0)} m; 100 m or better is required.` };
  }
  return { state: "VERIFIED", confidence: "HIGH", label: "Verified working", reason: "Attendance is active with fresh, accurate GPS evidence." };
}
