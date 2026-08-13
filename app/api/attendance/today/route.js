import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
import { dayKey } from "../_lib/attendance";

export async function GET(request) {
  await connectDB();
  const params = new URL(request.url).searchParams;
  const orgId = params.get("orgId"); const empId = params.get("empId");
  if (!orgId || !empId) return Response.json({ message: "Organization and employee are required." }, { status: 400 });
  const attendance = await Attendance.findOne({ orgId, empId, attendanceDate: dayKey() }).lean();
  const visits = attendance ? await EmployeeVisit.find({ attendanceId: attendance._id }).populate("clientSiteId", "clientName siteName address").sort({ startTime: -1 }).lean() : [];
  return Response.json({ attendance, visits });
}
