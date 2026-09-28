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

// GET /api/tasks/dashboard - Task Dashboard module (Director only, see
// lib/moduleAccess.ts "task-dashboard"). Strictly account-scoped: a
// director only ever sees tasks THEY PERSONALLY assigned
// (assignedByEmpId === the signed-in director's empId). Another director's
// assignments to the very same employee never appear here - each director
// gets their own private view of who they've assigned work to and how
// those assignments are progressing.
export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["DIRECTOR"]);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    // Only this director's own assignments - the account-based isolation
    // the whole module is built around.
    const tasks = await Task.find({
      orgId: identity.orgId,
      assignedByEmpId: identity.empId,
      assignedToEmpIds: { $exists: true, $ne: [] },
    })
      .select("taskId description status assignedToEmpIds assignedAt completedDate closedAt")
      .lean();

    // Bucket every task under each of its assignees (a task with more than
    // one assignee - a "Team" task - counts toward every assignee).
    const byEmpId = new Map();
    for (const task of tasks) {
      const summary = taskSummary(task);
      for (const empId of task.assignedToEmpIds || []) {
        if (!byEmpId.has(empId)) byEmpId.set(empId, { assigned: [], completed: [], pending: [] });
        const bucket = byEmpId.get(empId);
        bucket.assigned.push(summary);
        if (task.status === "Done") bucket.completed.push(summary);
        else bucket.pending.push(summary);
      }
    }

    // The table only lists employees this director has actually assigned
    // something to - not the whole company roster.
    const empIds = [...byEmpId.keys()];
    if (empIds.length === 0) {
      return Response.json({ rows: [], total: 0 });
    }

    const employeeQuery = { orgId: identity.orgId, empId: { $in: empIds } };
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      employeeQuery.$or = [{ name: pattern }, { empId: pattern }];
    }

    const employees = await Employee.find(employeeQuery)
      .select("empId name photo")
      .sort({ name: 1 })
      .lean();

    const rows = employees.map((employee) => {
      const bucket = byEmpId.get(employee.empId) || { assigned: [], completed: [], pending: [] };
      return {
        empId: employee.empId,
        name: employee.name,
        photo: employee.photo || null,
        assignedCount: bucket.assigned.length,
        completedCount: bucket.completed.length,
        pendingCount: bucket.pending.length,
        assignedTasks: bucket.assigned,
        completedTasks: bucket.completed,
        pendingTasks: bucket.pending,
      };
    });

    return Response.json({ rows, total: rows.length });
  } catch (error) {
    return errorResponse(error, "Unable to load the task dashboard.");
  }
}