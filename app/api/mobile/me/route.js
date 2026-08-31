import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const employee = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId, status: "Active" }).select("name email photo designation isManager").lean();
    return Response.json({ user: { id: identity.userId, empId: identity.empId, orgId: identity.orgId, role: identity.role, name: employee?.name || identity.empId, email: employee?.email, photo: employee?.photo } });
  } catch (error) { return errorResponse(error, "Unable to refresh mobile profile."); }
}
