import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import { errorResponse, requireAttendanceUser } from "../_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";
import { visibleEmployeeIds } from "@/lib/access";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.ATTENDANCE_TEAM_READ));
    const allowedIds = await visibleEmployeeIds(identity);
    const employees = await Employee.find({ orgId: identity.orgId, status: "Active", ...(allowedIds ? { empId: { $in: allowedIds } } : {}) })
      .select("name empId")
      .sort({ name: 1 })
      .lean();
    return Response.json({ data: employees });
  } catch (error) {
    return errorResponse(error, "Unable to load employees.");
  }
}
