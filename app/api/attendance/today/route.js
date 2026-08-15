import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
import { dayKey, errorResponse, requireAttendanceUser } from "../_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();

    const attendance = await Attendance.findOne({
      orgId,
      empId,
      $or: [{ status: "IN" }, { attendanceDate: dayKey() }],
    })
      .sort({ status: 1, "markIn.time": -1 })
      .lean();

    const visits = attendance
      ? await EmployeeVisit.find({ attendanceId: attendance._id })
          .populate("clientSiteId", "clientName siteName address")
          .sort({ startTime: -1 })
          .lean()
      : [];

    return Response.json({ attendance, visits });
  } catch (error) {
    return errorResponse(error, "Unable to load today's attendance.");
  }
}
