import mongoose from "mongoose";
import Counter from "@/models/Counter";
import Employee from "@/models/Employee";
import Notification from "@/models/Notification";
import Task from "@/models/Task";
import User from "@/models/User";
import { visibleEmployeeIds } from "@/lib/access";
import { tenantFilter } from "@/lib/tenantScope.mjs";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";
import { AttendanceError } from "../../attendance/_lib/attendance";

// Roles allowed to create tasks, assign them, and edit
// Project No / Work-Order No / Tender No / Task status / Task Type / Assigned To
// via the edit page. Keep this in sync with the same constant in the tasks frontend pages.
//
// NOTE: "HR" is not currently assignable from any UI in this codebase -
// roles are auto-derived at login (ADMIN is set directly in the database,
// DIRECTOR/MANAGER are derived from the employee record). To let someone
// use the Tasks module as HR, set their User.role to "HR" directly in the
// database, the same way ADMIN users are provisioned today.
export const TASK_MANAGE_ROLES = rolesForPermission(PERMISSIONS.TASK_MANAGE);

// Roles that can see every task in the organization rather than only
// their own team's tasks (mirrors isOrganizationRole in lib/access.js).
export const TASK_ORG_WIDE_ROLES = rolesForPermission(PERMISSIONS.TASK_READ_ALL);

// Builds the same tenant + visibility-scoped Mongo query used by GET /api/tasks,
// so the tasks list, the filter-options endpoint, and single-task lookups all
// agree on which tasks a given identity is allowed to see.
export async function scopedTaskQuery(identity) {
  const query = tenantFilter(identity);
  if (!TASK_ORG_WIDE_ROLES.includes(identity.role)) {
    // Managers see their team's tasks; everyone else sees only tasks
    // they created or are assigned to (individually or as part of a team).
    const scopedEmpIds =
      identity.role === "MANAGER"
        ? await visibleEmployeeIds(identity, true)
        : [identity.empId];
    query.$or = [
      { assignedToEmpIds: { $in: scopedEmpIds } },
      { createdByEmpId: { $in: scopedEmpIds } },
    ];
  }
  return query;
}

// Loads a single task and throws unless the identity is allowed to see it -
// shared by the task detail/edit route and the notes route.
export async function scopedTask(id, identity) {
  if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid task.");
  const task = await Task.findOne({ _id: id, orgId: identity.orgId });
  if (!task) throw new AttendanceError("Task not found.", 404);

  if (TASK_ORG_WIDE_ROLES.includes(identity.role)) return task;
  if (task.createdByEmpId === identity.empId || (task.assignedToEmpIds || []).includes(identity.empId)) return task;
  if (identity.role === "MANAGER") {
    const teamIds = await visibleEmployeeIds(identity, true);
    const assignedToEmpIds = task.assignedToEmpIds || [];
    if (teamIds.some((empId) => assignedToEmpIds.includes(empId)) || teamIds.includes(task.createdByEmpId)) {
      return task;
    }
  }
  throw new AttendanceError("You are not allowed to access this task.", 403);
}

// Resolves a single empId's display name the same way withEmployeeNames does,
// for contexts (like adding a note) that only need one name looked up.
export async function resolveEmployeeName(orgId, empId) {
  const [employee, user] = await Promise.all([
    Employee.findOne({ orgId, empId }).select("name").lean(),
    User.findOne({ orgId, username: empId }).select("employeeName").lean(),
  ]);
  return employee?.name || user?.employeeName || empId;
}

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