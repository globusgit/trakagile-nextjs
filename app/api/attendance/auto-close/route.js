import { connectDB } from "@/lib/mongoose";
import {
  AttendanceError,
  attendanceExpectedEndAt,
  errorResponse,
  getActiveAttendance,
  getAttendancePolicy,
  requireAttendanceUser,
} from "../_lib/attendance";
import { closeAttendanceAfterNoResponse } from "../_lib/auto-close";

export async function POST() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const attendance = await getActiveAttendance(identity.orgId, identity.empId);
    if (!attendance) throw new AttendanceError("No active attendance found.", 404);
    const policy = await getAttendancePolicy(identity.orgId);
    const now = new Date();
    const expectedEndAt = attendanceExpectedEndAt(attendance, policy);
    const responseMinutes = Number(policy.markOutResponseMinutes) || 15;
    const responseDeadline = new Date(expectedEndAt.getTime() + responseMinutes * 60000);
    if (now < responseDeadline) {
      throw new AttendanceError("Automatic Mark Out time has not been reached.", 409);
    }
    const closed = await closeAttendanceAfterNoResponse(
      attendance,
      now,
      `No response within ${responseMinutes} minutes after the expected Mark Out time.`,
    );
    if (!closed) throw new AttendanceError("Attendance was already marked out.", 409);

    return Response.json({ message: "Attendance automatically marked out." });
  } catch (error) {
    return errorResponse(error, "Unable to automatically mark out.");
  }
}
