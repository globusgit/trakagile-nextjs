import Employee from "@/models/Employee";
import User from "@/models/User";

export const isOrganizationRole = (role) => ["ADMIN", "DIRECTOR"].includes(role);

export async function directReportEmployeeIds(identity, includeSelf = false) {
  const manager = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId })
    .select("_id name empId")
    .lean();
  const legacyManagerValues = [...new Set([identity.empId, manager?.empId, manager?.name].filter(Boolean))];
  const reports = await Employee.find({
    orgId: identity.orgId,
    $or: [
      ...(manager ? [{ reportingTo: manager._id }] : []),
      { reportingManager: { $in: legacyManagerValues } },
    ],
  }).select("empId").lean();
  return [...new Set([...(includeSelf ? [identity.empId] : []), ...reports.map((employee) => employee.empId)])];
}

export async function visibleEmployeeIds(identity, includeSelf = false) {
  if (isOrganizationRole(identity.role)) return null;
  if (identity.role === "MANAGER") return directReportEmployeeIds(identity, includeSelf);
  return [identity.empId];
}

export async function userIdsForEmployeeIds(orgId, employeeIds) {
  if (!employeeIds?.length) return [];
  const users = await User.find({ orgId, username: { $in: employeeIds } }).select("_id").lean();
  return users.map((user) => user._id);
}
