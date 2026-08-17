import { connectDB } from "@/lib/mongoose";
import EmployeeVisit from "@/models/EmployeeVisit";
import {
  AttendanceError,
  dateAtZonedMinutes,
  dayKey,
  errorResponse,
  getActiveAttendance,
  getAttendancePolicy,
  minutesInTimeZone,
  requireAttendanceUser,
} from "../_lib/attendance";

export async function POST() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const attendance = await getActiveAttendance(identity.orgId, identity.empId);
    if (!attendance) throw new AttendanceError("No active attendance found.", 404);
    if (!attendance.lastKnownLocation) {
      throw new AttendanceError("Automatic Mark Out requires a saved location.", 409);
    }

    const policy = await getAttendancePolicy(identity.orgId);
    const now = new Date();
    const isOldAttendance = attendance.attendanceDate !== dayKey(now);
    const overtimeDeadline = attendance.overtime?.active && attendance.overtime.expectedEndAt
      ? new Date(attendance.overtime.expectedEndAt.getTime() + policy.overtimeGraceMinutes * 60000)
      : null;
    const fieldDeadline = attendance.attendanceType === "FIELD_VISIT" && attendance.expectedWorkEndAt
      ? new Date(attendance.expectedWorkEndAt.getTime() + policy.overtimeGraceMinutes * 60000)
      : null;
    const flexibleDeadline = overtimeDeadline || fieldDeadline;

    if (flexibleDeadline && now < flexibleDeadline) {
      throw new AttendanceError("The approved work period is still active.", 409);
    }
    if (!isOldAttendance && !flexibleDeadline && minutesInTimeZone(now, policy.timeZone) < policy.autoCloseMinutes) {
      throw new AttendanceError("Automatic Mark Out time has not been reached.", 409);
    }

    const closedAt = flexibleDeadline
      ? now
      : dateAtZonedMinutes(attendance.attendanceDate, policy.autoCloseMinutes, policy.timeZone);
    const totalWorkedMinutes = Math.max(
      0,
      Math.round((closedAt.getTime() - attendance.markIn.time.getTime()) / 60000),
    );

    const activeVisit = await EmployeeVisit.findOne({
      attendanceId: attendance._id,
      status: "IN_PROGRESS",
    });
    if (activeVisit) {
      activeVisit.set({
        endTime: closedAt,
        endLocation: attendance.lastKnownLocation,
        durationMinutes: Math.max(
          0,
          Math.round((closedAt.getTime() - activeVisit.startTime.getTime()) / 60000),
        ),
        status: "COMPLETED",
        remarks: activeVisit.remarks || "Visit automatically closed with attendance.",
      });
      await activeVisit.save();
    }

    attendance.set({
      markOut: { time: closedAt, location: attendance.lastKnownLocation },
      status: "OUT",
      trackingStatus: "STOPPED",
      totalWorkedMinutes,
      closureType: "AUTO",
      autoMarkOutReason: overtimeDeadline
        ? "Overtime completion grace period expired."
        : fieldDeadline
          ? "Field work completion grace period expired."
        : "Scheduled automatic Mark Out.",
      "overtime.active": false,
      "overtime.endedAt": closedAt,
    });
    await attendance.save();

    return Response.json({ message: "Attendance automatically marked out.", data: attendance });
  } catch (error) {
    return errorResponse(error, "Unable to automatically mark out.");
  }
}
