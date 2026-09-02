import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import TrackingLocation from "@/models/TrackingLocation";
import { dayKey, errorResponse, getAttendancePolicy, requireAttendanceUser } from "../../_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();
    const policy = await getAttendancePolicy(orgId);
    const attendance = await Attendance.findOne({
      orgId,
      empId,
      $or: [{ status: "IN" }, { attendanceDate: dayKey(new Date(), policy.timeZone) }],
    }).sort({ status: 1, "markIn.time": -1 })
      .select("_id status markIn markOut totalDistanceMeters")
      .lean();
    if (!attendance) return Response.json({ locations: [], route: null });
    const locations = await TrackingLocation.find({ orgId, attendanceId: attendance._id })
      .sort({ capturedAt: 1 })
      .limit(1000)
      .select("latitude longitude accuracy speed heading capturedAt receivedAt locationName locationNameRefreshed")
      .lean();
    return Response.json({
      locations,
      route: {
        status: attendance.status,
        distanceMeters: attendance.totalDistanceMeters || 0,
        start: attendance.markIn ? {
          ...attendance.markIn.location,
          recordedAt: attendance.markIn.time,
        } : null,
        end: attendance.markOut?.location ? {
          ...attendance.markOut.location,
          recordedAt: attendance.markOut.time,
        } : null,
      },
    });
  } catch (error) {
    return errorResponse(error, "Unable to load today's location history.");
  }
}
