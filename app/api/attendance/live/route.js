import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import { attendanceTracks } from "@/lib/attendanceTracks";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";
import { notifyAttendance } from "../_lib/notifications";
import { workStatusFor } from "../_lib/work-status";
import { visibleEmployeeIds } from "@/lib/access";
import { TRACKING_STALE_MS } from "@/lib/trackingPolicy.mjs";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.ATTENDANCE_LIVE_READ));
    const visibleIds = await visibleEmployeeIds(identity);
    const employees = await Employee.find({
      orgId: identity.orgId,
      status: "Active",
      ...(visibleIds ? { empId: { $in: visibleIds } } : {}),
    }).select("name empId photo reportingTo").lean();

    if (!employees.length) return Response.json({ employees: [] });
    const empIds = employees.map((employee) => employee.empId);
    const attendances = await Attendance.find({ orgId: identity.orgId, empId: { $in: empIds }, status: "IN" }).lean();
    const tracks = await attendanceTracks(identity.orgId, attendances);
    const employeeById = new Map(employees.map((employee) => [employee.empId, employee]));
    const now = Date.now();
    await Promise.all(attendances.map((attendance) => {
      const location = tracks.get(String(attendance._id))?.location;
      const heartbeatAt = attendance.lastLocationReceivedAt || location?.receivedAt;
      if (heartbeatAt && now - new Date(heartbeatAt).getTime() <= TRACKING_STALE_MS) return null;
      return notifyAttendance({
        orgId: identity.orgId,
        empId: attendance.empId,
        attendanceId: attendance._id,
        type: "LOCATION_STALE",
        title: "GPS heartbeat missing",
        message: `${attendance.empId} has not sent a GPS update for more than six minutes. The browser may be closed or connectivity may be unavailable.`,
        dedupeKey: `${attendance._id}:location-stale`,
      });
    }));
    return Response.json({
      employees: attendances.map((attendance) => {
        const expectedEndAt = attendance.overtime?.active
          ? attendance.overtime.expectedEndAt
          : attendance.expectedWorkEndAt;
        const track = tracks.get(String(attendance._id));
        return ({
        employee: employeeById.get(attendance.empId),
        attendance,
        schedule: {
          dispatchedAt: attendance.markIn?.time || null,
          expectedEndAt: expectedEndAt || null,
          serverNow: new Date(now),
          remainingSeconds: expectedEndAt
            ? Math.round((new Date(expectedEndAt).getTime() - now) / 1000)
            : null,
        },
        ...track,
        workStatus: workStatusFor(attendance, track?.location),
      });}),
    });
  } catch (error) {
    if (error instanceof AttendanceError) return errorResponse(error);
    return errorResponse(error, "Unable to load live attendance.");
  }
}
