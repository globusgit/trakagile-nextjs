import Counter from "@/models/Counter";
import Employee from "@/models/Employee";
import Notification from "@/models/Notification";
import User from "@/models/User";

// Roles allowed to create tasks, assign them, and edit
// Project No / Work-Order No / Tender No / Task status / Task Type / Assigned To
// via the edit page. Keep this in sync with the same constant in the tasks frontend pages.
//
// NOTE: "HR" is not currently assignable from any UI in this codebase -
// roles are auto-derived at login (ADMIN is set directly in the database,
// DIRECTOR/MANAGER are derived from the employee record). To let someone
// use the Tasks module as HR, set their User.role to "HR" directly in the
// database, the same way ADMIN users are provisioned today.
export const TASK_MANAGE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER", "HR"];

// Roles that can see every task in the organization rather than only
// their own team's tasks (mirrors isOrganizationRole in lib/access.js).
export const TASK_ORG_WIDE_ROLES = ["ADMIN", "DIRECTOR", "HR"];

export async function nextTaskId(orgId) {
  const counter = await Counter.findOneAndUpdate(
    { orgId, name: "task" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `TSK-${String(counter.seq).padStart(5, "0")}`;
}

// Attaches human-readable names for createdBy / assignedTo (array) / assignedBy,
// looked up by empId from the Employee collection (falls back to the
// User's stored employeeName if the employee record is missing).
export async function withEmployeeNames(orgId, tasks) {
  const empIds = [
    ...new Set(
      tasks.flatMap((task) => [
        task.createdByEmpId,
        ...(task.assignedToEmpIds || []),
        task.assignedByEmpId,
      ].filter(Boolean)),
    ),
  ];
  if (!empIds.length) return tasks;

  const [employees, users] = await Promise.all([
    Employee.find({ orgId, empId: { $in: empIds } }).select("empId name").lean(),
    User.find({ orgId, username: { $in: empIds } }).select("username employeeName").lean(),
  ]);
  const nameByEmpId = new Map();
  users.forEach((user) => nameByEmpId.set(user.username, user.employeeName));
  employees.forEach((employee) => nameByEmpId.set(employee.empId, employee.name));

  return tasks.map((task) => {
    const assignedToEmpIds = task.assignedToEmpIds || [];
    return {
      ...task,
      createdByName: nameByEmpId.get(task.createdByEmpId) || task.createdByEmpId,
      assignedToNames: assignedToEmpIds.map((empId) => ({
        empId,
        name: nameByEmpId.get(empId) || empId,
      })),
      assignedByName: task.assignedByEmpId ? nameByEmpId.get(task.assignedByEmpId) || task.assignedByEmpId : null,
    };
  });
}

export async function notifyTask({ orgId, recipientEmpId, employeeEmpId, type, title, message, dedupeKey }) {
  try {
    await Notification.updateOne(
      { orgId, recipientEmpId, dedupeKey },
      { $setOnInsert: { orgId, recipientEmpId, employeeEmpId, type, title, message, dedupeKey } },
      { upsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) console.error("[TASKS] Notification failed:", error);
  }
}

// Normalizes a reference-number payload (Project No / Work-Order No / Tender No)
// coming from the frontend into the embedded schema shape, or undefined if the
// number itself was left blank (so the task is treated as "Internal").
export function normalizeReference(input) {
  const number = String(input?.number || "").trim();
  if (!number) return undefined;
  return {
    number,
    description: String(input?.description || "").trim() || undefined,
    vertical: String(input?.vertical || "").trim() || undefined,
    subVertical: String(input?.subVertical || "").trim() || undefined,
    status: String(input?.status || "").trim() || undefined,
    state: String(input?.state || "").trim() || undefined,
  };
}