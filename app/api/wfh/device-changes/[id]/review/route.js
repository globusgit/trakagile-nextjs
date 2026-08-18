import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import WfhDeviceChange from "@/models/WfhDeviceChange";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../../../attendance/_lib/attendance";
import { notifyAttendance } from "../../../../attendance/_lib/notifications";

export async function PATCH(request, { params }) {
  try {
    await connectDB(); const identity = await requireAttendanceUser(["MANAGER", "DIRECTOR", "ADMIN"]); const { id } = await params; const body = await request.json();
    if (!mongoose.isValidObjectId(id) || !["APPROVED", "REJECTED"].includes(body.status)) throw new AttendanceError("Invalid device review.");
    const change = await WfhDeviceChange.findOne({ _id: id, orgId: identity.orgId, status: "PENDING" }).select("+newDevice.deviceIdHash +newDevice.ipHash");
    if (!change) throw new AttendanceError("Pending device request not found.", 404);
    if (identity.role === "MANAGER") { const manager = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId }).select("_id").lean(); if (!await Employee.exists({ orgId: identity.orgId, empId: change.employeeId, reportingTo: manager?._id })) throw new AttendanceError("This employee does not report to you.", 403); }
    if (body.status === "APPROVED") {
      const attendance = await Attendance.findOne({ _id: change.attendanceId, orgId: identity.orgId, status: "IN", attendanceType: "WORK_FROM_HOME" });
      if (!attendance) throw new AttendanceError("Active WFH attendance is unavailable.", 409);
      attendance.wfhDevice = { ...change.newDevice.toObject(), boundAt: new Date(), lastSeenAt: new Date() };
      await attendance.save();
    }
    change.set({ status: body.status, reviewedBy: identity.empId, reviewedAt: new Date(), reviewRemarks: String(body.remarks || "").trim() }); await change.save();
    await notifyAttendance({ orgId: identity.orgId, empId: change.employeeId, attendanceId: change.attendanceId, type: "DEVICE_CHANGE_REVIEWED", title: `WFH device change ${body.status.toLowerCase()}`, message: change.reviewRemarks || `Manager ${body.status.toLowerCase()} the device change.`, dedupeKey: `${change._id}:reviewed` });
    return Response.json({ data: change });
  } catch (error) { return errorResponse(error, "Unable to review device change."); }
}
