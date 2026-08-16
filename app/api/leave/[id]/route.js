import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

const elevated = (role) => ["ADMIN", "MANAGER"].includes(role);
const owns = (leave, identity) => String(leave.userId) === String(identity.userId);

async function scopedLeave(id, identity) {
  if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid leave request.");
  const leave = await LeaveRequest.findOne({ _id: id, orgId: identity.orgId });
  if (!leave) throw new AttendanceError("Leave request not found.", 404);
  if (!elevated(identity.role) && !owns(leave, identity)) throw new AttendanceError("You are not allowed to access this leave request.", 403);
  return leave;
}

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    return Response.json(await scopedLeave(id, identity));
  } catch (error) {
    return errorResponse(error, "Unable to load leave request.");
  }
}

export async function PUT(request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    const body = await request.json();
    const leave = await scopedLeave(id, identity);
    const action = body.action;

    if (["approve_cancellation", "reject_cancellation"].includes(action) && !elevated(identity.role)) {
      throw new AttendanceError("Manager or administrator approval is required.", 403);
    }
    if (["cancel_pending", "request_cancellation"].includes(action) && !owns(leave, identity)) {
      throw new AttendanceError("Only the employee can request or cancel this leave.", 403);
    }

    if (action === "cancel_pending") {
      if (leave.status !== "pending") throw new AttendanceError("Only pending leave requests can be cancelled.", 409);
      leave.status = "cancelled"; leave.cancellationReason = String(body.cancellationReason || "").trim(); leave.cancellationRequestedAt = new Date();
    } else if (action === "request_cancellation") {
      if (leave.status !== "approved") throw new AttendanceError("Only approved leave requests can have cancellation requested.", 409);
      leave.status = "cancellation_pending"; leave.cancellationReason = String(body.cancellationReason || "").trim(); leave.cancellationRequestedAt = new Date();
    } else if (action === "approve_cancellation") {
      if (leave.status !== "cancellation_pending") throw new AttendanceError("This request has no pending cancellation.", 409);
      leave.status = "cancelled";
    } else if (action === "reject_cancellation") {
      if (leave.status !== "cancellation_pending") throw new AttendanceError("This request has no pending cancellation.", 409);
      leave.status = "approved"; leave.cancellationDecisionReason = String(body.cancellationDecisionReason || "").trim();
    } else {
      if (!owns(leave, identity)) throw new AttendanceError("Only the employee can edit this leave request.", 403);
      if (leave.status !== "pending") throw new AttendanceError(`This request is already ${leave.status} and cannot be edited.`, 409);
      const startDate = new Date(body.startDate); const endDate = new Date(body.endDate); const days = Number(body.days);
      if (!body.leaveType || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate || !Number.isFinite(days) || days <= 0) throw new AttendanceError("Enter valid leave details.");
      leave.set({ leaveType: body.leaveType, startDate, endDate, days, reason: String(body.reason || "").trim() });
    }
    await leave.save();
    return Response.json({ message: "Leave request updated successfully.", data: leave });
  } catch (error) {
    return errorResponse(error, "Unable to update leave request.");
  }
}
