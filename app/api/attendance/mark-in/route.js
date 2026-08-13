import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import TrackingLocation from "@/models/TrackingLocation";
import { dayKey, errorResponse, getEmployee, locationFrom } from "../_lib/attendance";

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const employee = await getEmployee(body.orgId, body.empId);
    const now = new Date();
    const location = locationFrom(body, now);
    const existing = await Attendance.findOne({ orgId: body.orgId, empId: body.empId, attendanceDate: dayKey(now) });
    if (existing) throw new Error("Attendance is already marked for today.");
    const attendance = await Attendance.create({
      empObjId: employee._id, empId: employee.empId, orgId: employee.orgId,
      attendanceDate: dayKey(now), markIn: { time: now, location },
      lastKnownLocation: location, lastLocationReceivedAt: now,
    });
    await TrackingLocation.create({ attendanceId: attendance._id, employeeId: employee.empId, orgId: employee.orgId, ...location });
    return Response.json({ data: attendance }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
