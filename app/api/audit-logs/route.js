import { connectDB } from "@/lib/mongoose";
import ActivityLog from "@/models/ActivityLog";
import Employee from "@/models/Employee";
import User from "@/models/User";
import { errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.AUDIT_READ));
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25));
    const search = searchParams.get("search")?.trim() || "";
    const action = searchParams.get("action")?.trim() || "";
    const entityType = searchParams.get("entityType")?.trim() || "";
    const query = { orgId: identity.orgId };

    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      const matchingUsers = await User.find({
        orgId: identity.orgId,
        $or: [{ username: pattern }, { employeeName: pattern }, { role: pattern }],
      }).select("_id").lean();
      query.$or = [
        { action: pattern }, { entityType: pattern }, { details: pattern },
        { userId: { $in: matchingUsers.map((user) => user._id) } },
      ];
    }

    const [logs, total, actions, entityTypes] = await Promise.all([
      ActivityLog.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityLog.countDocuments(query),
      ActivityLog.distinct("action", { orgId: identity.orgId }),
      ActivityLog.distinct("entityType", { orgId: identity.orgId }),
    ]);
    const users = await User.find({ orgId: identity.orgId, _id: { $in: logs.map((log) => log.userId) } })
      .select("username employeeName role").lean();
    const employees = await Employee.find({ orgId: identity.orgId, empId: { $in: users.map((user) => user.username) } })
      .select("empId name photo").lean();
    const employeesById = new Map(employees.map((employee) => [employee.empId, employee]));
    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const enrichedLogs = logs.map((log) => {
      const user = usersById.get(String(log.userId));
      const employee = user ? employeesById.get(user.username) : null;
      return {
        ...log,
        actor: {
          name: employee?.name || user?.employeeName || "System user",
          empId: employee?.empId || user?.username || "System",
          role: user?.role || "SYSTEM",
          photo: employee?.photo || "",
        },
      };
    });

    return Response.json({
      logs: enrichedLogs, total, page, limit,
      filters: { actions: actions.sort(), entityTypes: entityTypes.sort() },
    });
  } catch (error) {
    return errorResponse(error, "Unable to load audit logs.");
  }
}
