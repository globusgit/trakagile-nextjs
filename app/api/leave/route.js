import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import { isOrganizationRole, userIdsForEmployeeIds, visibleEmployeeIds } from "@/lib/access";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 10));
    const query = { orgId: identity.orgId };
    if (!isOrganizationRole(identity.role)) {
      const employeeIds = await visibleEmployeeIds(identity, true);
      query.userId = { $in: await userIdsForEmployeeIds(identity.orgId, employeeIds) };
    }
    const [leaves, total] = await Promise.all([
      LeaveRequest.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      LeaveRequest.countDocuments(query),
    ]);
    return Response.json({ leaves, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return errorResponse(error, "Unable to load leave requests.");
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const startDate = new Date(body.startDate); const endDate = new Date(body.endDate); const days = Number(body.days);
    if (!mongoose.isValidObjectId(identity.userId)) throw new AttendanceError("Your user profile is invalid.", 403);
    if (!body.leaveType || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate || !Number.isFinite(days) || days <= 0) throw new AttendanceError("Enter valid leave details.");
    const leave = await LeaveRequest.create({ userId: identity.userId, leaveType: body.leaveType, startDate, endDate, days, reason: String(body.reason || "").trim(), orgId: identity.orgId, status: "pending" });
    return Response.json({ message: "Leave request submitted successfully.", data: leave }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to submit leave request.");
  }
}
