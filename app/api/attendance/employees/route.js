import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import { errorResponse, requireAttendanceUser } from "../_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId } = await requireAttendanceUser(["ADMIN", "DIRECTOR", "MANAGER"]);
    const employees = await Employee.find({ orgId, status: "Active" })
      .select("name empId")
      .sort({ name: 1 })
      .lean();
    return Response.json({ data: employees });
  } catch (error) {
    return errorResponse(error, "Unable to load employees.");
  }
}
