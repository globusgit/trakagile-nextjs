import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import Task from "@/models/Task";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Which tasks feed the employee table below the cards:
//   "all"  -> every task assigned to each employee, across ALL directors
//             (task details from another director's tasks are hidden, only
//             the counts / ID / status / dates are shown)
//   "mine" -> only the tasks THIS director assigned (previous behaviour)
const TABLE_SCOPE = "all";

const PRIVATE_DESCRIPTION = "Private task (assigned by another director)";

// Lightweight shape of a task used in the hover cards - only what the UI
// needs (Task ID / description / assigned date / end date), not the full
// Task document. `restricted` tasks belong to another director, so their
// description is not exposed.
function taskSummary(task, restricted) {
  return {
    taskId: task.taskId,
    description: restricted ? PRIVATE_DESCRIPTION : task.description,
    restricted,
    status: task.status,
    assignedAt: task.assignedAt || null,
    // "End date" = the date the task stopped being open: completedDate for
    // Done, closedAt for Rejected, null while it's still New/Assigned/In
    // Progress/Suspended (it hasn't ended yet).
    endDate: task.completedDate || task.closedAt || null,
  };
}

// Status buckets used everywhere on this page (cards AND table):
//   completed -> Done
//   suspended -> Suspended
//   pending   -> everything else (New / Assigned / In Progress / Rejected)
// so total === pending + completed + suspended.
function statsFor(tasks) {
  const stats = { total: tasks.length, pending: 0, completed: 0, suspended: 0 };
  for (const task of tasks) {
    if (task.status === "Done") stats.completed += 1;
    else if (task.status === "Suspended") stats.suspended += 1;
    else stats.pending += 1;
  }
  return stats;
}

// GET /api/tasks/dashboard - Task Dashboard module (Director only, see
// lib/moduleAccess.ts "task-dashboard").
//
// Cards (top of the page):
//   overall      -> EVERY task in the organization, across all directors
//   assignedByMe -> tasks THIS director assigned to someone
//   assignedToMe -> tasks assigned to THIS director
//
// Table: EVERY employee in the organization, with counts of their tasks
// (see TABLE_SCOPE above). Employees with no tasks come back with zero
// counts (the UI shows them white).
export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["DIRECTOR"]);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const me = identity.empId;

    // One query for the whole organization; everything below is derived from it.
    const allTasks = await Task.find({ orgId: identity.orgId })
      .select("taskId description status createdByEmpId assignedByEmpId assignedToEmpIds assignedAt completedDate closedAt")
      .lean();

    const hasAssignees = (task) => (task.assignedToEmpIds || []).length > 0;
    const assignedByMe = allTasks.filter((task) => task.assignedByEmpId === me && hasAssignees(task));
    const assignedToMe = allTasks.filter((task) => (task.assignedToEmpIds || []).includes(me));

    // A director may see the details of a task only if they created it,
    // assigned it, or it was assigned to them.
    const canSeeDetails = (task) =>
      task.createdByEmpId === me ||
      task.assignedByEmpId === me ||
      (task.assignedToEmpIds || []).includes(me);

    // ---- Cards -----------------------------------------------------------
    const cards = {
      overall: statsFor(allTasks),
      assignedByMe: statsFor(assignedByMe),
      assignedToMe: statsFor(assignedToMe),
    };

    // ---- Table -----------------------------------------------------------
    // Bucket every task under each of its assignees (a "Team" task counts
    // toward every assignee).
    const tableTasks = TABLE_SCOPE === "all" ? allTasks.filter(hasAssignees) : assignedByMe;
    const byEmpId = new Map();
    for (const task of tableTasks) {
      const summary = taskSummary(task, !canSeeDetails(task));
      for (const empId of task.assignedToEmpIds || []) {
        if (!byEmpId.has(empId)) byEmpId.set(empId, { assigned: [], completed: [], pending: [], suspended: [] });
        const bucket = byEmpId.get(empId);
        bucket.assigned.push(summary);
        if (task.status === "Done") bucket.completed.push(summary);
        else if (task.status === "Suspended") bucket.suspended.push(summary);
        else bucket.pending.push(summary);
      }
    }

    // All employees of the organization (not just the ones with tasks).
    // To hide inactive staff, add `status: "Active"` to this query.
    const employeeQuery = { orgId: identity.orgId };
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      employeeQuery.$or = [{ name: pattern }, { empId: pattern }];
    }

    const employees = await Employee.find(employeeQuery)
      .select("empId name photo")
      .sort({ name: 1 })
      .lean();

    const rows = employees.map((employee) => {
      const bucket = byEmpId.get(employee.empId) || { assigned: [], completed: [], pending: [], suspended: [] };
      return {
        empId: employee.empId,
        name: employee.name,
        photo: employee.photo || null,
        assignedCount: bucket.assigned.length,
        completedCount: bucket.completed.length,
        pendingCount: bucket.pending.length,
        suspendedCount: bucket.suspended.length,
        assignedTasks: bucket.assigned,
        completedTasks: bucket.completed,
        pendingTasks: bucket.pending,
        suspendedTasks: bucket.suspended,
      };
    });

    return Response.json(
      { cards, rows, total: rows.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, "Unable to load the task dashboard.");
  }
}