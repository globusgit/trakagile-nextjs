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

const DEFAULT_TRACK_LIMIT = 200;
const MAX_TRACK_LIMIT = 1000;

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.ATTENDANCE_LIVE_READ));
    const { searchParams } = new URL(request.url);
    const limit = Math.min(MAX_TRACK_LIMIT, Math.max(DEFAULT_TRACK_LIMIT, Number(searchParams.get("limit")) || DEFAULT_TRACK_LIMIT));
    const cursor = searchParams.get("cursor") || undefined;

    const visibleIds = await visibleEmployeeIds(identity);
    const employees = await Employee.find({
      orgId: identity.orgId,
      status: "Active",
      ...(visibleIds ? { empId: { $in: visibleIds } } : {}),
    }).select("name empId photo reportingTo").lean();

    if (!employees.length) return Response.json({ employees: [], nextCursor: null });
    const empIds = employees.map((employee) => employee.empId);

    const attendanceQuery = { orgId: identity.orgId, empId: { $in: empIds }, status: "IN" };
    if (cursor) {
      attendanceQuery._id = { $gt: cursor };
    }
    const attendances = await Attendance.find(attendanceQuery)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean();

    const hasMore = attendances.length > limit;
    const paginatedAttendances = hasMore ? attendances.slice(0, limit) : attendances;
    const nextCursor = hasMore ? String(paginatedAttendances[paginatedAttendances.length - 1]._id) : null;

    const tracks = await attendanceTracks(identity.orgId, paginatedAttendances);
    const employeeById = new Map(employees.map((employee) => [employee.empId, employee]));
    const now = Date.now();
    await Promise.allSettled(paginatedAttendances.map((attendance) => {
      const location = tracks.get(String(attendance._id))?.location;
      const heartbeatAt = attendance.lastLocationReceivedAt || location?.receivedAt;
      if (heartbeatAt && now - new Date(heartbeatAt).getTime() <= TRACKING_STALE_MS) return Promise.resolve();
      return notifyAttendance({
        orgId: identity.orgId,
        empId: attendance.empId,
        attendanceId: attendance._id,
        type: "LOCATION_STALE",
        title: "GPS heartbeat missing",
        message: `${attendance.empId} has not sent a GPS update for more than six minutes. The browser may be closed or connectivity may be unavailable.`,
        dedupeKey: `${attendance._id}:location-stale`,
      }).catch((notificationError) => {
        console.error("Failed to send stale-location notification:", notificationError);
      });
    }));
    return Response.json({
      employees: paginatedAttendances.map((attendance) => {
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
      nextCursor,
    });
  } catch (error) {
    if (error instanceof AttendanceError) return errorResponse(error);
    return errorResponse(error, "Unable to load live attendance.");
  }
}
