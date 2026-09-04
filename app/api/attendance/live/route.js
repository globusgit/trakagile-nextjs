import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import TrackingLocation from "@/models/TrackingLocation";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";
import { notifyAttendance } from "../_lib/notifications";
import { workStatusFor } from "../_lib/work-status";
import { visibleEmployeeIds } from "@/lib/access";

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
    const attendanceIds = attendances.map((attendance) => attendance._id);
    const locations = attendanceIds.length
      ? await TrackingLocation.aggregate([
          { $match: { orgId: identity.orgId, attendanceId: { $in: attendanceIds } } },
          { $sort: { receivedAt: -1 } },
          { $group: { _id: "$attendanceId", location: { $first: "$$ROOT" } } },
        ])
      : [];
    const histories = attendanceIds.length
      ? await TrackingLocation.aggregate([
          // A trigger represents a newly resolved locality, not every GPS heartbeat.
          { $match: { orgId: identity.orgId, attendanceId: { $in: attendanceIds }, locationNameRefreshed: true } },
          { $sort: { capturedAt: -1 } },
          { $group: { _id: "$attendanceId", points: { $push: { latitude: "$latitude", longitude: "$longitude", accuracy: "$accuracy", speed: "$speed", capturedAt: "$capturedAt", receivedAt: "$receivedAt", locationName: "$locationName", locationNameRefreshed: "$locationNameRefreshed" } } } },
          { $project: { points: { $slice: ["$points", 250] } } },
        ])
      : [];
    const movements = attendanceIds.length
      ? await TrackingLocation.aggregate([
          { $match: { orgId: identity.orgId, attendanceId: { $in: attendanceIds } } },
          { $sort: { receivedAt: -1 } },
          { $group: { _id: "$attendanceId", points: { $push: { latitude: "$latitude", longitude: "$longitude", accuracy: "$accuracy", speed: "$speed", capturedAt: "$capturedAt", receivedAt: "$receivedAt", locationName: "$locationName", locationNameRefreshed: "$locationNameRefreshed" } } } },
          // One point every ~45 seconds is about 960 points for a 12-hour shift.
          // Keep the full working-day trail while retaining a defensive ceiling.
          { $project: { points: { $slice: ["$points", 1200] } } },
        ])
      : [];
    const locationByAttendance = new Map(locations.map((item) => [String(item._id), item.location]));
    const employeeById = new Map(employees.map((employee) => [employee.empId, employee]));
    const historyByAttendance = new Map(histories.map((item) => [String(item._id), item.points]));
    const movementByAttendance = new Map(movements.map((item) => [String(item._id), item.points.reverse()]));
    const now = Date.now();
    await Promise.all(attendances.map((attendance) => {
      const location = locationByAttendance.get(String(attendance._id)) || attendance.lastKnownLocation || attendance.markIn?.location;
      if (location && now - new Date(location.receivedAt).getTime() <= 5 * 60_000) return null;
      return notifyAttendance({
        orgId: identity.orgId,
        empId: attendance.empId,
        attendanceId: attendance._id,
        type: "LOCATION_STALE",
        title: "GPS heartbeat missing",
        message: `${attendance.empId} has not sent a GPS update for more than five minutes. The browser may be closed or connectivity may be unavailable.`,
        dedupeKey: `${attendance._id}:location-stale`,
      });
    }));
    return Response.json({
      employees: attendances.map((attendance) => {
        const expectedEndAt = attendance.overtime?.active
          ? attendance.overtime.expectedEndAt
          : attendance.expectedWorkEndAt;
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
        location: locationByAttendance.get(String(attendance._id)) || attendance.lastKnownLocation || attendance.markIn?.location || null,
        workStatus: workStatusFor(attendance, locationByAttendance.get(String(attendance._id)) || attendance.lastKnownLocation || attendance.markIn?.location || null),
        triggerPoints: (() => {
          const namedTriggers = historyByAttendance.get(String(attendance._id)) || [];
          const start = attendance.markIn?.location;
          const isMarkInPoint = (point) => start &&
            Math.abs(point.latitude - start.latitude) < 0.000001 &&
            Math.abs(point.longitude - start.longitude) < 0.000001;
          return [
            ...(start ? [{ ...start, type: "MARK_IN" }] : []),
            ...namedTriggers
              .filter((point) => !isMarkInPoint(point))
              .map((point) => ({ ...point, type: "LOCATION_TRIGGER" })),
          ];
        })(),
        movementPoints: movementByAttendance.get(String(attendance._id)) || [],
      });}),
    });
  } catch (error) {
    if (error instanceof AttendanceError) return errorResponse(error);
    return errorResponse(error, "Unable to load live attendance.");
  }
}
