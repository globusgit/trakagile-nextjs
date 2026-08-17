import { connectDB } from "@/lib/mongoose";
import {
  AttendanceError,
  errorResponse,
  getActiveAttendance,
  requireAttendanceUser,
} from "../_lib/attendance";

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const reason = body.reason?.trim();
    const expectedEndAt = new Date(body.expectedEndAt);
    const now = new Date();

    if (!reason) throw new AttendanceError("Overtime reason is required.");
    if (Number.isNaN(expectedEndAt.getTime()) || expectedEndAt <= now) {
      throw new AttendanceError("Expected completion time must be in the future.");
    }
    if (expectedEndAt.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
      throw new AttendanceError("Expected completion time cannot exceed 24 hours.");
    }

    const attendance = await getActiveAttendance(identity.orgId, identity.empId);
    if (!attendance) throw new AttendanceError("No active attendance found.", 404);

    attendance.workMode = "OVERTIME";
    attendance.overtime = {
      active: true,
      reason,
      startedAt: attendance.overtime?.startedAt || now,
      expectedEndAt,
    };
    await attendance.save();

    return Response.json({
      message: "Continue Working enabled.",
      data: attendance,
    });
  } catch (error) {
    return errorResponse(error, "Unable to continue working.");
  }
}
