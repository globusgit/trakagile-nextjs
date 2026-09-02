import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import TrackingLocation from "@/models/TrackingLocation";
import { visibleEmployeeIds } from "@/lib/access";
import { dayKey, errorResponse, getAttendancePolicy, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.DASHBOARD_TEAM_READ));
    const policy = await getAttendancePolicy(identity.orgId);
    const visibleIds = await visibleEmployeeIds(identity);
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
      ? await Attendance.find({ orgId: identity.orgId, empId: { $in: empIds } })
          .select("empId attendanceDate status lastKnownLocation lastKnownLocationName lastLocationReceivedAt markIn markOut updatedAt")
          .sort({ attendanceDate: -1, updatedAt: -1 })
          .lean()
      : [];

    const today = dayKey(new Date(), policy.timeZone);
    const presentIds = new Set(attendance.filter((item) => item.attendanceDate === today).map((item) => item.empId));
    // A monitoring dashboard must never present an older attendance location
    // as if it were live. Only today's marked attendance belongs on this map.
    const todayByEmployee = new Map();
    for (const item of attendance) {
      if (item.attendanceDate === today && !todayByEmployee.has(item.empId)) {
        todayByEmployee.set(item.empId, item);
      }
    }
    const todayAttendance = [...todayByEmployee.values()];
    const trackingPoints = todayAttendance.length
      ? await TrackingLocation.find({ orgId: identity.orgId, attendanceId: { $in: todayAttendance.map((item) => item._id) } })
          .select("attendanceId latitude longitude capturedAt receivedAt locationName locationNameRefreshed speed heading")
          .sort({ capturedAt: 1 })
          .limit(5000)
          .lean()
      : [];
    const pointsByAttendance = new Map();
    for (const point of trackingPoints) {
      const key = String(point.attendanceId);
      if (!pointsByAttendance.has(key)) pointsByAttendance.set(key, []);
      pointsByAttendance.get(key).push(point);
    }

    const locations = employees.flatMap((employee) => {
      const item = todayByEmployee.get(employee.empId);
      const point = item?.lastKnownLocation || item?.markOut?.location || item?.markIn?.location;
      if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return [];
      const rawRoute = pointsByAttendance.get(String(item._id)) || [];
      const sampleEvery = Math.max(1, Math.ceil(rawRoute.length / 400));
      const route = rawRoute.filter((routePoint, index) =>
        index === 0 || index === rawRoute.length - 1 || routePoint.locationNameRefreshed || index % sampleEvery === 0,
      ).map((routePoint, index, sampled) => ({
        latitude: routePoint.latitude,
        longitude: routePoint.longitude,
        capturedAt: routePoint.capturedAt || routePoint.receivedAt,
        locationName: routePoint.locationName || null,
        speed: routePoint.speed,
        heading: routePoint.heading,
        type: index === 0 ? "MARK_IN" : index === sampled.length - 1 ? (item.status === "OUT" ? "MARK_OUT" : "LIVE") : routePoint.locationNameRefreshed ? "TRIGGER" : "TRACK",
      }));
      return [{
        empId: employee.empId,
        name: employee.name,
        designation: employee.designation || "Employee",
        photo: employee.photo || null,
        latitude: point.latitude,
        longitude: point.longitude,
        locationName: point.locationName || item.lastKnownLocationName || "Location name unavailable",
        receivedAt: point.receivedAt || point.capturedAt || item.lastLocationReceivedAt || item.updatedAt,
        attendanceDate: item.attendanceDate,
        markInAt: item.markIn?.time || null,
        markOutAt: item.markOut?.time || null,
        attendanceStatus: item.status,
        presentToday: presentIds.has(employee.empId),
        route,
      }];
    });

    return Response.json({
      date: today,
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
