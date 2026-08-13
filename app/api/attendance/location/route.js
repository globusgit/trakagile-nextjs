import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
import TrackingLocation from "@/models/TrackingLocation";
import { errorResponse, getActiveAttendance, locationFrom } from "../_lib/attendance";

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const attendance = await getActiveAttendance(body.orgId, body.empId);
    if (!attendance) throw new Error("No active attendance found.");
    const now = new Date();
    const location = locationFrom(body, now);
    const visit = await EmployeeVisit.findOne({ attendanceId: attendance._id, status: "IN_PROGRESS" });
    await Promise.all([
      TrackingLocation.create({ attendanceId: attendance._id, employeeId: body.empId, visitId: visit?._id || null, orgId: body.orgId, ...location, speed: body.speed, heading: body.heading }),
      Attendance.updateOne({ _id: attendance._id }, { $set: { lastKnownLocation: location, lastLocationReceivedAt: now, trackingStatus: "ACTIVE" } }),
    ]);
    return Response.json({ message: "Location updated.", receivedAt: now });
  } catch (error) { return errorResponse(error); }
}
