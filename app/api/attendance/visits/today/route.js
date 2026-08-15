import { connectDB } from "@/lib/mongoose";
import EmployeeVisit from "@/models/EmployeeVisit";
import { errorResponse, getActiveAttendance, requireAttendanceUser } from "../../_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();
    const attendance = await getActiveAttendance(orgId, empId);
    const data = attendance
      ? await EmployeeVisit.find({ attendanceId: attendance._id })
          .populate("clientSiteId", "clientName siteName address")
          .sort({ startTime: -1 })
          .lean()
      : [];
    return Response.json({ data });
  } catch (error) {
    return errorResponse(error, "Unable to load visits.");
  }
}
