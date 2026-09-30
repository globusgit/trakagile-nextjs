import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import Task from "@/models/Task";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Lightweight shape of a task used in the hover cards - only what the UI
// needs (Task ID / description / assigned date / end date), not the full
// Task document.
function taskSummary(task) {
  return {
    taskId: task.taskId,
    description: task.description,
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
//   overall    -> every task the director assigned OR that was assigned to them
//   assignedByMe -> tasks the director assigned to someone
//   assignedToMe -> tasks assigned to the director
//
// Table: EVERY employee in the organisation, with counts of the tasks THIS
// director assigned to them (another director's assignments never appear).
// Employees with no tasks come back with zero counts (the UI shows them white).
export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["DIRECTOR"]);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    const [assignedByMe, assignedToMe] = await Promise.all([
      Task.find({
        orgId: identity.orgId,
        assignedByEmpId: identity.empId,
        assignedToEmpIds: { $exists: true, $ne: [] },
      })
        .select("taskId description status assignedToEmpIds assignedAt completedDate closedAt")
        .lean(),
      Task.find({
        orgId: identity.orgId,
        assignedToEmpIds: identity.empId,
      })
        .select("_id status")
        .lean(),
    ]);

    // ---- Cards -----------------------------------------------------------
    // Overall = union of the two sets, de-duplicated (a task the director
    // assigned to themselves is in both sets but counts once).
    const overallById = new Map();
    for (const task of assignedByMe) overallById.set(String(task._id), task);
    for (const task of assignedToMe) overallById.set(String(task._id), overallById.get(String(task._id)) || task);

    const cards = {
      overall: statsFor([...overallById.values()]),
      assignedByMe: statsFor(assignedByMe),
      assignedToMe: statsFor(assignedToMe),
    };

    // ---- Table -----------------------------------------------------------
    // Bucket every task this director assigned under each of its assignees
    // (a "Team" task counts toward every assignee).
    const byEmpId = new Map();
    for (const task of assignedByMe) {
      const summary = taskSummary(task);
      for (const empId of task.assignedToEmpIds || []) {
        if (!byEmpId.has(empId)) byEmpId.set(empId, { assigned: [], completed: [], pending: [], suspended: [] });
        const bucket = byEmpId.get(empId);
        bucket.assigned.push(summary);
        if (task.status === "Done") bucket.completed.push(summary);
        else if (task.status === "Suspended") bucket.suspended.push(summary);
        else bucket.pending.push(summary);
      }
    }

    // All employees of the organisation (not just the ones with tasks).
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

    return Response.json({ cards, rows, total: rows.length });
  } catch (error) {
    return errorResponse(error, "Unable to load the task dashboard.");
  }
}