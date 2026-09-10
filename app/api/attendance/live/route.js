import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import TrackingLocation from "@/models/TrackingLocation";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";
import { notifyAttendance } from "../_lib/notifications";
import { workStatusFor } from "../_lib/work-status";
import { visibleEmployeeIds } from "@/lib/access";
import { cleanLocationTrack, latestLocation, locationTriggerPoints, trackLengthMeters } from "@/lib/locationTrack.mjs";

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
          { $sort: { capturedAt: -1, receivedAt: -1 } },
          { $group: { _id: "$attendanceId", location: { $first: "$$ROOT" } } },
        ])
      : [];
    const histories = attendanceIds.length
      ? await TrackingLocation.aggregate([
          // Keep every scheduled minute heartbeat as a visible trigger. Legacy
          // locality triggers remain visible for attendance recorded by older apps.
          { $match: { orgId: identity.orgId, attendanceId: { $in: attendanceIds }, $or: [{ minuteTrigger: true }, { locationNameRefreshed: true }] } },
          { $sort: { capturedAt: -1 } },
          { $group: { _id: "$attendanceId", points: { $push: { latitude: "$latitude", longitude: "$longitude", accuracy: "$accuracy", speed: "$speed", capturedAt: "$capturedAt", receivedAt: "$receivedAt", locationName: "$locationName", locationNameRefreshed: "$locationNameRefreshed", minuteTrigger: "$minuteTrigger" } } } },
          // Retain the complete working-day trigger list for each employee.
          { $project: { points: { $slice: ["$points", 1200] } } },
        ])
      : [];
    const movements = attendanceIds.length
      ? await TrackingLocation.aggregate([
          { $match: { orgId: identity.orgId, attendanceId: { $in: attendanceIds }, $or: [{ accuracy: { $exists: false } }, { accuracy: { $lte: 50 } }] } },
          { $sort: { capturedAt: -1, receivedAt: -1 } },
          { $group: { _id: "$attendanceId", points: { $push: { latitude: "$latitude", longitude: "$longitude", accuracy: "$accuracy", speed: "$speed", capturedAt: "$capturedAt", receivedAt: "$receivedAt", locationName: "$locationName", locationNameRefreshed: "$locationNameRefreshed" } } } },
          // Allow a full shift at the mobile stream interval of 15 seconds.
          // Keep the full working-day trail while retaining a defensive ceiling.
          { $project: { points: { $slice: ["$points", 6000] } } },
        ])
      : [];
    const locationByAttendance = new Map(locations.map((item) => [String(item._id), item.location]));
    const employeeById = new Map(employees.map((employee) => [employee.empId, employee]));
    const historyByAttendance = new Map(histories.map((item) => [String(item._id), item.points]));
    const movementByAttendance = new Map(movements.map((item) => [String(item._id), item.points.reverse()]));
    const now = Date.now();
    await Promise.all(attendances.map((attendance) => {
      const location = locationByAttendance.get(String(attendance._id)) || attendance.lastKnownLocation || attendance.markIn?.location;
      const heartbeatAt = attendance.lastLocationReceivedAt || location?.receivedAt;
      if (heartbeatAt && now - new Date(heartbeatAt).getTime() <= 5 * 60_000) return null;
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
        const movementPoints = cleanLocationTrack(
          movementByAttendance.get(String(attendance._id)) || [],
        );
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
        location: latestLocation(locationByAttendance.get(String(attendance._id)), attendance.lastKnownLocation && {
          ...attendance.lastKnownLocation,
          locationName: attendance.lastKnownLocationName || attendance.lastKnownLocation.locationName,
        }, attendance.markIn?.location),
        workStatus: workStatusFor(attendance, latestLocation(locationByAttendance.get(String(attendance._id)), attendance.lastKnownLocation, attendance.markIn?.location)),
        triggerPoints: locationTriggerPoints(
          historyByAttendance.get(String(attendance._id)) || [],
          attendance.markIn?.location,
        ),
        movementPoints,
        filteredDistanceMeters: Math.round(trackLengthMeters(movementPoints)),
      });}),
    });
  } catch (error) {
    if (error instanceof AttendanceError) return errorResponse(error);
    return errorResponse(error, "Unable to load live attendance.");
  }
}
