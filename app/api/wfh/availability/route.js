import { connectDB } from "@/lib/mongoose";
import WorkFromHomeRequest from "@/models/WorkFromHomeRequest";
import { dayKey, errorResponse, getAttendancePolicy, requireAttendanceUser } from "../../attendance/_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();
    const policy = await getAttendancePolicy(orgId);
    const today = dayKey(new Date(), policy.timeZone);
    const request = await WorkFromHomeRequest.findOne({
      orgId,
      employeeId: empId,
      status: "APPROVED",
      fromDate: { $lte: today },
      toDate: { $gte: today },
    }).select("_id fromDate toDate dayType workLocation radiusMeters").lean();
    return Response.json({ enabled: Boolean(request), request: request || null });
  } catch (error) {
    return errorResponse(error, "Unable to check WFH availability.");
  }
}
