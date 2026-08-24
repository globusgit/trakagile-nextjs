import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import User from "@/models/User";
import { isOrganizationRole, visibleEmployeeIds } from "@/lib/access";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { notifyAttendance } from "../../attendance/_lib/notifications";
import { applyLeaveBalance, assertNoLeaveOverlap, calculateLeaveDays, isLeaveReviewer } from "../_lib/leave";

const owns = (leave, identity) => String(leave.userId) === String(identity.userId);

async function scopedLeave(id, identity) {
  if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid leave request.");
  const leave = await LeaveRequest.findOne({ _id: id, orgId: identity.orgId });
  if (!leave) throw new AttendanceError("Leave request not found.", 404);
  if (!isOrganizationRole(identity.role) && !owns(leave, identity)) {
    const employeeIds = await visibleEmployeeIds(identity);
    const permitted = await User.exists({
      _id: leave.userId,
      orgId: identity.orgId,
      username: { $in: employeeIds },
    });
    if (!permitted) throw new AttendanceError("You are not allowed to access this leave request.", 403);
  }
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

    if (["approve", "reject", "approve_cancellation", "reject_cancellation"].includes(action) && !isLeaveReviewer(identity.role)) {
      throw new AttendanceError("Manager or administrator approval is required.", 403);
    }
    if (["approve", "reject", "approve_cancellation", "reject_cancellation"].includes(action) && owns(leave, identity)) {
      throw new AttendanceError("You cannot review your own leave request.", 403);
    }
    if (["cancel_pending", "request_cancellation"].includes(action) && !owns(leave, identity)) {
      throw new AttendanceError("Only the employee can request or cancel this leave.", 403);
    }

    if (action === "approve") {
      if (leave.status !== "pending") throw new AttendanceError("Only pending leave requests can be approved.", 409);
      await applyLeaveBalance(leave, 1);
      leave.status = "approved";
      leave.balanceApplied = true;
      leave.approvedBy = identity.userId;
      leave.approvedAt = new Date();
      leave.rejectionReason = undefined;
    } else if (action === "reject") {
      if (leave.status !== "pending") throw new AttendanceError("Only pending leave requests can be rejected.", 409);
      const rejectionReason = String(body.rejectionReason || "").trim();
      if (!rejectionReason) throw new AttendanceError("Rejection reason is required.");
      leave.status = "rejected";
      leave.approvedBy = identity.userId;
      leave.approvedAt = new Date();
      leave.rejectionReason = rejectionReason;
    } else if (action === "cancel_pending") {
      if (leave.status !== "pending") throw new AttendanceError("Only pending leave requests can be cancelled.", 409);
      leave.status = "cancelled"; leave.cancellationReason = String(body.cancellationReason || "").trim(); leave.cancellationRequestedAt = new Date();
    } else if (action === "request_cancellation") {
      if (leave.status !== "approved") throw new AttendanceError("Only approved leave requests can have cancellation requested.", 409);
      leave.status = "cancellation_pending"; leave.cancellationReason = String(body.cancellationReason || "").trim(); leave.cancellationRequestedAt = new Date();
    } else if (action === "approve_cancellation") {
      if (leave.status !== "cancellation_pending") throw new AttendanceError("This request has no pending cancellation.", 409);
      if (leave.balanceApplied) {
        await applyLeaveBalance(leave, -1);
        leave.balanceApplied = false;
      }
      leave.status = "cancelled";
    } else if (action === "reject_cancellation") {
      if (leave.status !== "cancellation_pending") throw new AttendanceError("This request has no pending cancellation.", 409);
      leave.status = "approved"; leave.cancellationDecisionReason = String(body.cancellationDecisionReason || "").trim();
    } else {
      if (!owns(leave, identity)) throw new AttendanceError("Only the employee can edit this leave request.", 403);
      if (leave.status !== "pending") throw new AttendanceError(`This request is already ${leave.status} and cannot be edited.`, 409);
      const startDate = new Date(body.startDate); const endDate = new Date(body.endDate);
      if (!body.leaveType || !String(body.reason || "").trim()) throw new AttendanceError("Leave type and reason are required.");
      const days = await calculateLeaveDays(identity.orgId, startDate, endDate, body.days);
      await assertNoLeaveOverlap({ orgId: identity.orgId, userId: leave.userId, startDate, endDate, excludeId: leave._id });
      leave.set({ leaveType: body.leaveType, startDate, endDate, days, reason: String(body.reason || "").trim() });
    }
    await leave.save();
    const employee = await User.findOne({ _id: leave.userId, orgId: identity.orgId }).select("username").lean();
    if (employee?.username) {
      const reviewed = ["approve", "reject"].includes(action);
      const cancellation = ["request_cancellation", "approve_cancellation", "reject_cancellation", "cancel_pending"].includes(action);
      await notifyAttendance({
        orgId: identity.orgId,
        empId: employee.username,
        type: reviewed ? "LEAVE_REVIEWED" : cancellation ? "LEAVE_CANCELLATION" : "LEAVE_REQUEST",
        title: reviewed ? `Leave ${leave.status}` : cancellation ? "Leave cancellation updated" : "Leave request updated",
        message: `${leave.leaveType} leave for ${leave.days} day(s) is ${leave.status}.`,
        dedupeKey: `${leave._id}:${action || "edited"}:${leave.updatedAt?.getTime?.() || Date.now()}`,
      }).catch((notificationError) => console.error("[LEAVE] Notification failed:", notificationError));
    }
    return Response.json({ message: "Leave request updated successfully.", data: leave });
  } catch (error) {
    return errorResponse(error, "Unable to update leave request.");
  }
}
