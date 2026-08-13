import { connectDB } from "@/lib/mongoose";
import EmployeeVisit from "@/models/EmployeeVisit";
import VisitedSite from "@/models/VisitedSite";
import { errorResponse, getActiveAttendance, locationFrom } from "../../_lib/attendance";

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const attendance = await getActiveAttendance(body.orgId, body.empId);
    if (!attendance) throw new Error("Mark in before starting a visit.");
    if (await EmployeeVisit.exists({ attendanceId: attendance._id, status: "IN_PROGRESS" })) throw new Error("Complete the active visit before starting another.");
    const site = await VisitedSite.findOne({ _id: body.clientSiteId, orgId: body.orgId, status: "ACTIVE" });
    if (!site) throw new Error("Client/site not found.");
    if (!body.purpose?.trim()) throw new Error("Visit purpose is required.");
    const now = new Date(); const location = locationFrom(body, now);
    const visit = await EmployeeVisit.create({ attendanceId: attendance._id, employeeId: body.empId, clientSiteId: site._id, orgId: body.orgId, purpose: body.purpose, startTime: now, startLocation: location });
    attendance.totalVisits += 1; await attendance.save();
    return Response.json({ data: visit }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
