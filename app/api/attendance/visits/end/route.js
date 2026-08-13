import { connectDB } from "@/lib/mongoose";
import EmployeeVisit from "@/models/EmployeeVisit";
import { errorResponse, getActiveAttendance, locationFrom } from "../../_lib/attendance";

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const attendance = await getActiveAttendance(body.orgId, body.empId);
    if (!attendance) throw new Error("No active attendance found.");
    const visit = await EmployeeVisit.findOne({ attendanceId: attendance._id, employeeId: body.empId, orgId: body.orgId, status: "IN_PROGRESS" });
    if (!visit) throw new Error("No active visit found.");
    const now = new Date(); const location = locationFrom(body, now);
    visit.endTime = now; visit.endLocation = location; visit.remarks = body.remarks;
    visit.durationMinutes = Math.max(0, Math.round((now.getTime() - visit.startTime.getTime()) / 60000));
    visit.status = "COMPLETED"; await visit.save();
    return Response.json({ data: visit });
  } catch (error) { return errorResponse(error); }
}
