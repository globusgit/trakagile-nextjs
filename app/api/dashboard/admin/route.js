import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import { attendanceTracks } from "@/lib/attendanceTracks";
import { visibleEmployeeIds } from "@/lib/access";
import { dayKey, errorResponse, getAttendancePolicy, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.DASHBOARD_TEAM_READ));
    const policy = await getAttendancePolicy(identity.orgId);
    const visibleIds = await visibleEmployeeIds(identity);
    const selectedDate = new URL(request.url).searchParams.get("date") || dayKey(new Date(), policy.timeZone);
    const employees = await Employee.find({
      orgId: identity.orgId,
      status: "Active",
      ...(visibleIds ? { empId: { $in: visibleIds } } : {}),
    })
      .select("name empId photo designation")
      .sort({ name: 1 })
      .lean();
    const empIds = employees.map((employee) => employee.empId);
    const attendance = empIds.length
      ? await Attendance.find({ orgId: identity.orgId, empId: { $in: empIds }, attendanceDate: selectedDate })
          .select("empId attendanceDate status trackingStatus totalDistanceMeters lastKnownLocation lastKnownLocationName lastLocationReceivedAt markIn markOut updatedAt")
          .sort({ attendanceDate: -1, updatedAt: -1 })
          .lean()
      : [];

    const presentIds = new Set(attendance.map((item) => item.empId));
    const selectedDateByEmployee = new Map();
    for (const item of attendance) {
      if (!selectedDateByEmployee.has(item.empId)) {
        selectedDateByEmployee.set(item.empId, item);
      }
    }
    const selectedAttendance = [...selectedDateByEmployee.values()];
    const tracks = await attendanceTracks(identity.orgId, selectedAttendance);

    const locations = employees.flatMap((employee) => {
      const item = selectedDateByEmployee.get(employee.empId);
      const track = tracks.get(String(item?._id));
      const point = track?.location;
      if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return [];
      const route = track.movementPoints.map((point) => ({ ...point, type: "TRACK" }));
      const events = track.triggerPoints.map((point) => ({ ...point, type: point.type === "MARK_IN" ? "MARK_IN" : "TRIGGER" }));
      if (item.markOut?.location) events.push({ ...item.markOut.location, capturedAt: item.markOut.time, type: "MARK_OUT" });
      return [{
        empId: employee.empId,
        name: employee.name,
        designation: employee.designation || "Employee",
        photo: employee.photo || null,
        latitude: point.latitude,
        longitude: point.longitude,
        locationName: point.locationName || item.lastKnownLocationName || "Location name unavailable",
        receivedAt: item.lastLocationReceivedAt || point.capturedAt || point.receivedAt || item.updatedAt,
        attendanceDate: item.attendanceDate,
        markInAt: item.markIn?.time || null,
        markOutAt: item.markOut?.time || null,
        attendanceStatus: item.status,
        trackingStatus: item.trackingStatus || "ACTIVE",
        totalDistanceMeters: track.filteredDistanceMeters,
        presentToday: presentIds.has(employee.empId),
        route,
        events,
        accuracy: point.accuracy,
      }];
    });

    return Response.json({
      date: selectedDate,
      summary: {
        totalEmployees: employees.length,
        present: presentIds.size,
        absent: Math.max(0, employees.length - presentIds.size),
        located: locations.length,
        noLocation: Math.max(0, employees.length - locations.length),
      },
      employees: employees.map((employee) => ({
        empId: employee.empId,
        name: employee.name,
        designation: employee.designation || "Employee",
        photo: employee.photo || null,
        presentToday: presentIds.has(employee.empId),
        located: locations.some((location) => location.empId === employee.empId),
      })),
      locations,
    });
  } catch (error) {
    return errorResponse(error, "Unable to load the admin dashboard.");
  }
}
