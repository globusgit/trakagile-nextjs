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
    if (await EmployeeVisit.exists({ attendanceId: attendance._id, status: "IN_PROGRESS" })) throw new Error("Complete the active visit before marking out.");
    const now = new Date();
    const location = locationFrom(body, now);
    const totalWorkedMinutes = Math.max(0, Math.round((now.getTime() - attendance.markIn.time.getTime()) / 60000));
    await Promise.all([
      TrackingLocation.create({ attendanceId: attendance._id, employeeId: body.empId, orgId: body.orgId, ...location }),
      Attendance.updateOne({ _id: attendance._id }, { $set: { markOut: { time: now, location }, lastKnownLocation: location, lastLocationReceivedAt: now, status: "OUT", trackingStatus: "STOPPED", totalWorkedMinutes } }),
    ]);
    return Response.json({ message: "Attendance marked out successfully." });
  } catch (error) { return errorResponse(error); }
}
