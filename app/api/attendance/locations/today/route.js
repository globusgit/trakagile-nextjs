import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import TrackingLocation from "@/models/TrackingLocation";
import { dayKey, errorResponse, requireAttendanceUser } from "../../_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();
    const attendance = await Attendance.findOne({
      orgId,
      empId,
      $or: [{ status: "IN" }, { attendanceDate: dayKey() }],
    }).sort({ status: 1, "markIn.time": -1 }).select("_id").lean();
    if (!attendance) return Response.json({ locations: [] });
    const locations = await TrackingLocation.find({ orgId, attendanceId: attendance._id })
      .sort({ capturedAt: 1 })
      .limit(1000)
      .select("latitude longitude accuracy speed heading capturedAt receivedAt locationName")
      .lean();
    return Response.json({ locations });
  } catch (error) {
    return errorResponse(error, "Unable to load today's location history.");
  }
}
