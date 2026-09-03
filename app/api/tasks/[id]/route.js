import { connectDB } from "@/lib/mongoose";
import { TASK_STATUSES } from "@/models/Task";
import User from "@/models/User";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import {
  TASK_MANAGE_ROLES,
  normalizeReference,
  notifyTask,
  scopedTask,
  withEmployeeNames,
} from "../_lib/tasks";

// Statuses an assignee can move a task to via the in-progress dropdown,
// once they've clicked "Start Working".
const EMPLOYEE_WORK_STATUSES = ["In Progress", "Done", "Suspended", "Rejected"];

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    const task = await scopedTask(id, identity);
    const [enriched] = await withEmployeeNames(identity.orgId, [task.toObject()]);
    return Response.json({ ...enriched, canManage: TASK_MANAGE_ROLES.includes(identity.role) });
  } catch (error) {
    return errorResponse(error, "Unable to load task.");
  }
}

export async function PUT(request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    const body = await request.json();
    const task = await scopedTask(id, identity);
    const action = body.action;

    if (action === "assign") {
      // Quick single-employee "Assign" action, used from the Tasks list for
      // still-unassigned ("New") tasks.
      if (!TASK_MANAGE_ROLES.includes(identity.role)) {
        throw new AttendanceError("You are not allowed to assign tasks.", 403);
      }
      if (task.status !== "New") throw new AttendanceError("Only unassigned tasks can be assigned.", 409);
      const assignee = await User.findOne({ orgId: identity.orgId, username: body.assignedToEmpId }).lean();
      if (!assignee) throw new AttendanceError("Selected assignee could not be found.");

      task.set({
        status: "Assigned",
        assignedTo: [assignee._id],
        assignedToEmpIds: [assignee.username],
        assignedBy: identity.userId,
        assignedByEmpId: identity.empId,
        assignedAt: new Date(),
      });
      await task.save();
      await notifyTask({
        orgId: identity.orgId,
        recipientEmpId: assignee.username,
        employeeEmpId: identity.empId,
        type: "TASK_ASSIGNED",
        title: "New task assigned",
        message: `${task.taskId} was assigned to you: ${task.description.slice(0, 120)}`,
        dedupeKey: `${task._id}:assigned:${assignee.username}:${task.assignedAt.getTime()}`,
      });
    } else if (action === "start_working") {
      if (!(task.assignedToEmpIds || []).includes(identity.empId)) {
        throw new AttendanceError("Only an assigned employee can start working on this task.", 403);
      }
      if (task.status !== "Assigned") throw new AttendanceError("This task has already been started.", 409);
      task.status = "In Progress";
      await task.save();
    } else if (action === "update_status") {
      if (!(task.assignedToEmpIds || []).includes(identity.empId)) {
        throw new AttendanceError("Only an assigned employee can update this task's status.", 403);
      }
      if (!["In Progress", "Suspended"].includes(task.status)) {
        throw new AttendanceError("This task is not currently in progress.", 409);
      }
      const nextStatus = body.status;
      if (!EMPLOYEE_WORK_STATUSES.includes(nextStatus)) throw new AttendanceError("Invalid task status.");
      task.status = nextStatus;
      if (nextStatus === "Done") {
        task.completedDate = new Date();
        task.closedAt = task.completedDate;
      } else if (nextStatus === "Rejected") {
        task.closedAt = new Date();
      }
      await task.save();
      await notifyTask({
        orgId: identity.orgId,
        recipientEmpId: task.createdByEmpId,
        employeeEmpId: identity.empId,
        type: "TASK_STATUS_UPDATED",
        title: `Task ${nextStatus.toLowerCase()}`,
        message: `${task.taskId} is now ${nextStatus}.`,
        dedupeKey: `${task._id}:${nextStatus}:${task.updatedAt?.getTime?.() || Date.now()}`,
      });
    } else {
      // Full edit (edit page): Project No / Work-Order No / Tender No / Task Status /
      // Task Type / Sub-Task Type / Assigned To (multi-select) are all editable here.
      if (!TASK_MANAGE_ROLES.includes(identity.role)) {
        throw new AttendanceError("You are not allowed to edit this task.", 403);
      }
      const nextStatus = body.status;
      if (nextStatus && !TASK_STATUSES.includes(nextStatus)) throw new AttendanceError("Invalid task status.");

      const updates = {
        projectNo: normalizeReference(body.projectNo),
        workOrderNo: normalizeReference(body.workOrderNo),
        tenderNo: normalizeReference(body.tenderNo),
        taskType: String(body.taskType || "").trim() || undefined,
        subTaskType: String(body.subTaskType || "").trim() || undefined,
      };

      if (Array.isArray(body.assignedToEmpIds)) {
        const nextAssigneeIds = [...new Set(body.assignedToEmpIds.filter(Boolean))];
        const currentAssigneeIds = task.assignedToEmpIds || [];
        const changed =
          nextAssigneeIds.length !== currentAssigneeIds.length ||
          nextAssigneeIds.some((empId) => !currentAssigneeIds.includes(empId));

        if (changed) {
          let assignees = [];
          if (nextAssigneeIds.length) {
            assignees = await User.find({ orgId: identity.orgId, username: { $in: nextAssigneeIds } }).lean();
            if (assignees.length !== nextAssigneeIds.length) {
              throw new AttendanceError("One or more selected assignees could not be found.");
            }
          }
          updates.assignedTo = assignees.map((assignee) => assignee._id);
          updates.assignedToEmpIds = assignees.map((assignee) => assignee.username);
          updates.assignedBy = identity.userId;
          updates.assignedByEmpId = identity.empId;
          updates.assignedAt = assignees.length ? new Date() : undefined;

          if (assignees.length && task.status === "New") updates.status = "Assigned";
          if (!assignees.length) updates.status = "New";

          const newlyAdded = assignees.filter((assignee) => !currentAssigneeIds.includes(assignee.username));
          for (const assignee of newlyAdded) {
            await notifyTask({
              orgId: identity.orgId,
              recipientEmpId: assignee.username,
              employeeEmpId: identity.empId,
              type: "TASK_ASSIGNED",
              title: "New task assigned",
              message: `${task.taskId} was assigned to you: ${task.description.slice(0, 120)}`,
              dedupeKey: `${task._id}:assigned:${assignee.username}:${Date.now()}`,
            });
          }
        }
      }

      task.set(updates);
      if (nextStatus && nextStatus !== task.status) {
        task.status = nextStatus;
        if (nextStatus === "Done") {
          task.completedDate = new Date();
          task.closedAt = task.completedDate;
        } else if (nextStatus === "Rejected") {
          task.closedAt = new Date();
          task.completedDate = undefined;
        } else {
          // Reopening a previously closed task clears the freeze so Age resumes counting.
          task.closedAt = undefined;
          task.completedDate = undefined;
        }
      }
      await task.save();
    }

    const [enriched] = await withEmployeeNames(identity.orgId, [task.toObject()]);
    return Response.json({ message: "Task updated successfully.", data: enriched });
  } catch (error) {
    return errorResponse(error, "Unable to update task.");
  }
}