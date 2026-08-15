import { connectDB } from "@/lib/mongoose";
import { AttendanceError, errorResponse, getActiveAttendance, requireAttendanceUser } from "../_lib/attendance";
import { assertBoundDevice, deviceFrom } from "../../wfh/_lib/device";

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const attendance = await getActiveAttendance(identity.orgId, identity.empId, null, true);
    if (!attendance || attendance.attendanceType !== "WORK_FROM_HOME") throw new AttendanceError("Active WFH attendance is required.", 409);
    const device = deviceFrom(body, request); assertBoundDevice(attendance, device);
    const { action } = body; const now = new Date();
    if (action === "START") {
      if (attendance.wfh?.breakStartedAt) throw new AttendanceError("A break is already active.", 409);
      attendance.set("wfh.breakStartedAt", now);
    } else if (action === "END") {
      if (!attendance.wfh?.breakStartedAt) throw new AttendanceError("No active break found.", 409);
      const minutes = Math.max(0, Math.round((now.getTime() - attendance.wfh.breakStartedAt.getTime()) / 60000));
      attendance.set({ "wfh.breakStartedAt": undefined, "wfh.totalBreakMinutes": (attendance.wfh.totalBreakMinutes || 0) + minutes });
    } else throw new AttendanceError("Invalid break action.");
    attendance.set("wfhDevice.lastSeenAt", now);
    await attendance.save();
    return Response.json({ data: attendance });
  } catch (error) { return errorResponse(error, "Unable to update WFH break."); }
}
