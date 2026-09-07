import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions.mjs";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import { AttendanceError, attendanceExpectedEndAt, errorResponse, getAttendancePolicy } from "../_lib/attendance";
import { notifyAttendance } from "../_lib/notifications";
import { closeAttendanceAfterNoResponse } from "../_lib/auto-close";

export async function POST(request) {
  try {
    const suppliedSecret = request.headers.get("x-cron-secret");
    const cronAllowed = Boolean(process.env.CRON_SECRET && suppliedSecret === process.env.CRON_SECRET);
    if (!cronAllowed) {
      const session = await auth();
      if (!hasPermission(session?.user?.role, PERMISSIONS.ATTENDANCE_REMINDERS_RUN)) {
        throw new AttendanceError("Director access or a valid cron secret is required.", 403);
      }
    }
    await connectDB();
    const attendances = await Attendance.find({ status: "IN" });
    const policies = new Map();
    let created = 0;
    let autoClosed = 0;
    const now = new Date();
    for (const attendance of attendances) {
      if (!policies.has(attendance.orgId)) policies.set(attendance.orgId, await getAttendancePolicy(attendance.orgId));
      const policy = policies.get(attendance.orgId);
      const expectedEndAt = attendanceExpectedEndAt(attendance, policy);
      if (now < expectedEndAt) continue;
      const responseMinutes = Number(policy.markOutResponseMinutes) || 15;
      const responseDeadline = new Date(expectedEndAt.getTime() + responseMinutes * 60000);
      await notifyAttendance({ orgId: attendance.orgId, empId: attendance.empId, attendanceId: attendance._id, type: "POSSIBLE_DELAY", title: "Your Mark Out time has arrived", message: `${attendance.empId}: Mark Out now or choose Continue Working. If there is no response, active client/site work and attendance will close automatically after ${responseMinutes} minutes.`, dedupeKey: `${attendance._id}:mark-out-response:${expectedEndAt.toISOString()}` });
      created += 1;
      if (now >= responseDeadline) {
        const closed = await closeAttendanceAfterNoResponse(
          attendance,
          now,
          `No response within ${responseMinutes} minutes after the expected Mark Out time.`,
        );
        if (closed) autoClosed += 1;
      }
    }
    return Response.json({ checked: attendances.length, remindersProcessed: created, autoClosed });
  } catch (error) { return errorResponse(error, "Unable to process attendance reminders."); }
}
