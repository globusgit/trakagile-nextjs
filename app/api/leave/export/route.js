import { connectDB } from "@/lib/mongoose";
import { isOrganizationRole, userIdsForEmployeeIds, visibleEmployeeIds } from "@/lib/access";
import Employee from "@/models/Employee";
import LeaveRequest from "@/models/LeaveRequest";
import User from "@/models/User";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const query = { orgId: identity.orgId };
    if (!isOrganizationRole(identity.role)) {
      const employeeIds = await visibleEmployeeIds(identity, true);
      query.userId = { $in: await userIdsForEmployeeIds(identity.orgId, employeeIds) };
    }

    const leaves = await LeaveRequest.find(query).sort({ createdAt: -1 }).lean();
    const userIds = [...new Set(leaves.flatMap((leave) => [leave.userId, leave.approvedBy]).filter(Boolean).map(String))];
    const users = await User.find({ _id: { $in: userIds }, orgId: identity.orgId }).select("username").lean();
    const usernameById = new Map(users.map((user) => [String(user._id), user.username]));
    const employeeIds = [...new Set(users.map((user) => user.username).filter(Boolean))];
    const employees = await Employee.find({ orgId: identity.orgId, empId: { $in: employeeIds } }).select("empId name").lean();
    const nameByEmployeeId = new Map(employees.map((employee) => [employee.empId, employee.name]));
    const displayName = (id) => {
      const employeeId = usernameById.get(String(id));
      return nameByEmployeeId.get(employeeId) || employeeId || "";
    };

    const rows = [["Employee", "Leave Type", "Start Date", "End Date", "Days", "Status", "Reason", "Reviewed By", "Reviewed Date", "Rejection Reason"]];
    for (const leave of leaves) {
      rows.push([
        displayName(leave.userId), leave.leaveType, leave.startDate?.toISOString?.().slice(0, 10),
        leave.endDate?.toISOString?.().slice(0, 10), leave.days, leave.status, leave.reason,
        displayName(leave.approvedBy), leave.approvedAt?.toISOString?.(), leave.rejectionReason,
      ]);
    }
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leave-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error, "Unable to export leave requests.");
  }
}
