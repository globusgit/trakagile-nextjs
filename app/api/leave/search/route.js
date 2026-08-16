import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import User from "@/models/User";
import Employee from "@/models/Employee";
import { isOrganizationRole, userIdsForEmployeeIds, visibleEmployeeIds } from "@/lib/access";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

async function attachEmployeeNames(leaves, orgId) {
  const userIds = [...new Set(leaves.map((leave) => leave.userId?.toString()).filter(Boolean))];
  if (userIds.length === 0) return leaves;

  const users = await User.find({ _id: { $in: userIds } }).lean();
  const usernameByUserId = Object.fromEntries(
    users.map((user) => [user._id.toString(), user.username]),
  );
  const employeeIds = [...new Set(Object.values(usernameByUserId).filter(Boolean))];
  const employees = await Employee.find({ empId: { $in: employeeIds }, orgId }).lean();
  const nameByEmployeeId = Object.fromEntries(
    employees.map((employee) => [employee.empId, employee.name]),
  );

  return leaves.map((leave) => {
    const employeeId = usernameByUserId[leave.userId?.toString()];
    return { ...leave, employeeName: nameByEmployeeId[employeeId] || null };
  });
}

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit"), 10) || 10));
    const requestedUserId = searchParams.get("userId");
    const query = { orgId: identity.orgId };

    if (isOrganizationRole(identity.role)) {
      if (requestedUserId && mongoose.Types.ObjectId.isValid(requestedUserId)) {
        query.userId = requestedUserId;
      }
    } else {
      const employeeIds = await visibleEmployeeIds(identity, true);
      const userIds = await userIdsForEmployeeIds(identity.orgId, employeeIds);
      query.userId = requestedUserId && userIds.some((id) => String(id) === requestedUserId)
        ? requestedUserId
        : { $in: userIds };
    }

    const search = searchParams.get("search")?.trim();
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { leaveType: regex },
        { status: regex },
        { reason: regex },
        { rejectionReason: regex },
        {
          $expr: {
            $regexMatch: { input: { $toString: "$days" }, regex: regex.source, options: "i" },
          },
        },
      ];
    }

    const [rawLeaves, total] = await Promise.all([
      LeaveRequest.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LeaveRequest.countDocuments(query),
    ]);
    const leaves = await attachEmployeeNames(rawLeaves, identity.orgId);

    return Response.json({ leaves, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return errorResponse(error, "Unable to search leave requests.");
  }
}
