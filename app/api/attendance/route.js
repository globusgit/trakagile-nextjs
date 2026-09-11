import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import { AttendanceError, errorResponse, requireAttendanceUser } from "./_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";
import { visibleEmployeeIds } from "@/lib/access";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const date = searchParams.get("date")?.trim();
    const month = searchParams.get("month")?.trim();
    const mine = searchParams.get("mine") === "true";
    const employeeId = searchParams.get("empId")?.trim();

    const identity = mine || employeeId ? await requireAttendanceUser() : await requireAttendanceUser(rolesForPermission(PERMISSIONS.ATTENDANCE_TEAM_READ));
    const isTeamRead = !mine && !employeeId && rolesForPermission(PERMISSIONS.ATTENDANCE_TEAM_READ).includes(identity.role);
    const allowedIds = isTeamRead ? await visibleEmployeeIds(identity) : null;

    const match = { orgId: identity.orgId, ...(allowedIds ? { empId: { $in: allowedIds } } : {}) };
    if (mine || employeeId) {
      const targetEmployeeId = employeeId || identity.empId;
      if (employeeId && targetEmployeeId !== identity.empId && !isTeamRead) {
        throw new AttendanceError("You can only view your own attendance history.", 403);
      }
      match.empId = targetEmployeeId;
    }
    if (date) match.attendanceDate = date;
    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AttendanceError("Invalid attendance month.");
      match.attendanceDate = { $regex: `^${month}` };
    }

    const employeeMatch = search
      ? {
          $or: [
            { "employee.name": { $regex: escapeRegex(search), $options: "i" } },
            { empId: { $regex: escapeRegex(search), $options: "i" } },
          ],
        }
      : {};

    const [result] = await Attendance.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "employees",
          localField: "empObjId",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      { $match: employeeMatch },
      { $sort: { attendanceDate: -1, "markIn.time": -1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                empId: 1,
                employeeName: "$employee.name",
                attendanceDate: 1,
                markIn: 1,
                markOut: 1,
                status: 1,
                trackingStatus: 1,
                totalVisits: 1,
                totalWorkedMinutes: 1,
                attendanceType: 1,
                totalBreakMinutes: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]);

    return Response.json({
      data: result?.data || [],
      total: result?.total[0]?.count || 0,
      page,
      limit,
    });
  } catch (error) {
    return errorResponse(error, "Unable to load attendance history.");
  }
}
