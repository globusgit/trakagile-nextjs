import { connectDB } from "@/lib/mongoose";
import EmployeeVisit from "@/models/EmployeeVisit";
import {
  AttendanceError,
  errorResponse,
  getActiveAttendance,
  locationFrom,
  requireAttendanceUser,
} from "../../_lib/attendance";
import { notifyAttendance } from "../../_lib/notifications";

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const attendance = await getActiveAttendance(identity.orgId, identity.empId);
    if (!attendance) throw new AttendanceError("No active attendance found.", 404);

    const now = new Date();
    const location = locationFrom(body, now);
    const activeVisit = await EmployeeVisit.findOne({
      attendanceId: attendance._id,
      employeeId: identity.empId,
      orgId: identity.orgId,
      status: "IN_PROGRESS",
    });
    if (!activeVisit) throw new AttendanceError("No active visit found.", 404);

    const durationMinutes = Math.max(
      0,
      Math.round((now.getTime() - activeVisit.startTime.getTime()) / 60000),
    );
    const visit = await EmployeeVisit.findOneAndUpdate(
      {
        attendanceId: attendance._id,
        employeeId: identity.empId,
        orgId: identity.orgId,
        status: "IN_PROGRESS",
      },
      {
        $set: {
          endTime: now,
          endLocation: location,
          remarks: body.remarks?.trim(),
          durationMinutes,
          status: "COMPLETED",
        },
      },
      { new: true },
    );
    if (!visit) throw new AttendanceError("No active visit found.", 404);

    await notifyAttendance({
      orgId: identity.orgId,
      empId: identity.empId,
      attendanceId: attendance._id,
      type: "VISIT_COMPLETED",
      title: "Client/site visit completed",
      message: `${identity.empId} completed a client/site visit${visit.remarks ? `: ${visit.remarks}` : "."}`,
      dedupeKey: `${visit._id}:completed`,
    });

    return Response.json({ data: visit });
  } catch (error) {
    return errorResponse(error, "Unable to end visit.");
  }
}
