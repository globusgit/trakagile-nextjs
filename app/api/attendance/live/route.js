import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import TrackingLocation from "@/models/TrackingLocation";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../_lib/attendance";
import { notifyAttendance } from "../_lib/notifications";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["MANAGER", "ADMIN"]);
    const manager = identity.role === "MANAGER"
      ? await Employee.findOne({ orgId: identity.orgId, empId: identity.empId }).select("_id").lean()
      : null;
    const employees = identity.role === "ADMIN"
      ? await Employee.find({ orgId: identity.orgId, status: "Active" }).select("name empId reportingTo").lean()
      : await Employee.find({ orgId: identity.orgId, status: "Active" })
          .where("reportingTo")
          .equals(manager?._id)
          .select("name empId reportingTo")
          .lean();

    if (!employees.length) return Response.json({ employees: [] });
    const empIds = employees.map((employee) => employee.empId);
    const attendances = await Attendance.find({ orgId: identity.orgId, empId: { $in: empIds }, status: "IN" }).lean();
    const attendanceIds = attendances.map((attendance) => attendance._id);
    const locations = attendanceIds.length
      ? await TrackingLocation.aggregate([
          { $match: { attendanceId: { $in: attendanceIds } } },
          { $sort: { receivedAt: -1 } },
          { $group: { _id: "$attendanceId", location: { $first: "$$ROOT" } } },
        ])
      : [];
    const locationByAttendance = new Map(locations.map((item) => [String(item._id), item.location]));
    const employeeById = new Map(employees.map((employee) => [employee.empId, employee]));
    const now = Date.now();
    await Promise.all(attendances.map((attendance) => {
      const location = locationByAttendance.get(String(attendance._id));
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
      employees: attendances.map((attendance) => ({
        employee: employeeById.get(attendance.empId),
        attendance,
        location: locationByAttendance.get(String(attendance._id)) || null,
      })),
    });
  } catch (error) {
    if (error instanceof AttendanceError) return errorResponse(error);
    return errorResponse(error, "Unable to load live attendance.");
  }
}
