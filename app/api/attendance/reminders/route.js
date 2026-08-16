import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import { AttendanceError, errorResponse, getAttendancePolicy, minutesInTimeZone } from "../_lib/attendance";
import { notifyAttendance } from "../_lib/notifications";

export async function POST(request) {
  try {
    const suppliedSecret = request.headers.get("x-cron-secret");
    const cronAllowed = Boolean(process.env.CRON_SECRET && suppliedSecret === process.env.CRON_SECRET);
    if (!cronAllowed) {
      const session = await auth();
      if (!["ADMIN", "DIRECTOR"].includes(session?.user?.role || "")) {
        throw new AttendanceError("Director access or a valid cron secret is required.", 403);
      }
    }
    await connectDB();
    const attendances = await Attendance.find({ status: "IN" }).select("_id orgId empId attendanceDate expectedWorkEndAt overtime").lean();
    const policies = new Map();
    let created = 0;
    const now = new Date();
    for (const attendance of attendances) {
      if (!policies.has(attendance.orgId)) policies.set(attendance.orgId, await getAttendancePolicy(attendance.orgId));
      const policy = policies.get(attendance.orgId);
      const currentMinutes = minutesInTimeZone(now, policy.timeZone);
      const due = attendance.overtime?.active && attendance.overtime.expectedEndAt
        ? now >= new Date(attendance.overtime.expectedEndAt)
        : attendance.expectedWorkEndAt
          ? now >= new Date(attendance.expectedWorkEndAt)
          : currentMinutes >= policy.shiftEndMinutes;
      if (!due) continue;
      await notifyAttendance({ orgId: attendance.orgId, empId: attendance.empId, attendanceId: attendance._id, type: "POSSIBLE_DELAY", title: "Mark-out reminder", message: `${attendance.empId} is still marked in after the expected work end time. Mark out or record continued work.`, dedupeKey: `${attendance._id}:server-mark-out-reminder` });
      created += 1;
    }
    return Response.json({ checked: attendances.length, remindersProcessed: created });
  } catch (error) { return errorResponse(error, "Unable to process attendance reminders."); }
}
