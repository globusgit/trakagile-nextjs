import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import WorkFromHomeRequest from "@/models/WorkFromHomeRequest";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../../../attendance/_lib/attendance";
import { notifyAttendance } from "../../../../attendance/_lib/notifications";

export async function PATCH(request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["MANAGER", "DIRECTOR", "ADMIN"]);
    const { id } = await params; const body = await request.json();
    if (!mongoose.isValidObjectId(id) || !["APPROVED", "REJECTED"].includes(body.status)) throw new AttendanceError("Invalid review request.");
    const wfh = await WorkFromHomeRequest.findOne({ _id: id, orgId: identity.orgId, status: "PENDING" });
    if (!wfh) throw new AttendanceError("Pending WFH request not found.", 404);
    if (identity.role === "MANAGER") {
      const manager = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId }).select("_id").lean();
      const report = await Employee.exists({ orgId: identity.orgId, empId: wfh.employeeId, reportingTo: manager?._id });
      if (!report) throw new AttendanceError("This employee does not report to you.", 403);
    }
    wfh.set({ status: body.status, reviewedBy: identity.empId, reviewedAt: new Date(), reviewRemarks: String(body.remarks || "").trim() });
    await wfh.save();
    await notifyAttendance({ orgId: identity.orgId, empId: wfh.employeeId, type: "WFH_REVIEWED", title: `WFH request ${body.status.toLowerCase()}`, message: `${wfh.fromDate} to ${wfh.toDate}${wfh.reviewRemarks ? `: ${wfh.reviewRemarks}` : "."}`, dedupeKey: `${wfh._id}:reviewed` });
    return Response.json({ data: wfh });
  } catch (error) { return errorResponse(error, "Unable to review WFH request."); }
}
