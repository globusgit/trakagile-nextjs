import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import LeavesInfo from "@/models/LeavesInfo";
import User from "@/models/User";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.LEAVE_BALANCE_MANAGE));
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year") || new Date().getFullYear());
    const employees = await Employee.find({ orgId: identity.orgId, status: "Active" })
      .select("name empId")
      .sort({ name: 1 })
      .lean();
    const users = await User.find({
      orgId: identity.orgId,
      username: { $in: employees.map((employee) => employee.empId) },
    }).select("_id username").lean();
    const userByEmpId = new Map(users.map((user) => [user.username, user]));
    const balances = await LeavesInfo.find({
      orgId: identity.orgId,
      year,
      userId: { $in: users.map((user) => user._id) },
    }).lean();
    const balanceByUserId = new Map(balances.map((balance) => [String(balance.userId), balance]));
    return Response.json({
      year,
      employees: employees.flatMap((employee) => {
        const user = userByEmpId.get(employee.empId);
        if (!user) return [];
        return [{
          userId: String(user._id),
          empId: employee.empId,
          name: employee.name,
          balance: balanceByUserId.get(String(user._id)) || null,
        }];
      }),
    });
  } catch (error) {
    return errorResponse(error, "Unable to load employee leave allocations.");
  }
}
