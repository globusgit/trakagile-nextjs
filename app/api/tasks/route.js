import { connectDB } from "@/lib/mongoose";
import Task from "@/models/Task";
import User from "@/models/User";
import { visibleEmployeeIds } from "@/lib/access";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";
import {
  TASK_MANAGE_ROLES,
  TASK_ORG_WIDE_ROLES,
  nextTaskId,
  normalizeReference,
  notifyTask,
  withEmployeeNames,
} from "./_lib/tasks";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 10));
    const status = searchParams.get("status")?.trim() || "";
    const search = searchParams.get("search")?.trim() || "";

    const query = { orgId: identity.orgId };

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

    if (status) query.status = status;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      const searchClause = [
        { taskId: pattern },
        { description: pattern },
        { taskType: pattern },
        { subTaskType: pattern },
        { "projectNo.number": pattern },
        { "workOrderNo.number": pattern },
        { "tenderNo.number": pattern },
      ];
      query.$and = [...(query.$or ? [{ $or: query.$or }] : []), { $or: searchClause }];
      delete query.$or;
    }

    const [tasks, total] = await Promise.all([
      Task.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Task.countDocuments(query),
    ]);

    return Response.json({
      tasks: await withEmployeeNames(identity.orgId, tasks),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      canCreate: TASK_MANAGE_ROLES.includes(identity.role),
    });
  } catch (error) {
    return errorResponse(error, "Unable to load tasks.");
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(TASK_MANAGE_ROLES);
    const body = await request.json();
    const description = String(body.description || "").trim();
    if (!description) throw new AttendanceError("Task description is required.");

    const assignedToEmpIds = [...new Set((body.assignedToEmpIds || []).filter(Boolean))];
    let assignees = [];
    if (assignedToEmpIds.length) {
      assignees = await User.find({ orgId: identity.orgId, username: { $in: assignedToEmpIds } }).lean();
      if (assignees.length !== assignedToEmpIds.length) {
        throw new AttendanceError("One or more selected assignees could not be found.");
      }
    }

    const now = new Date();
    const task = await Task.create({
      taskId: await nextTaskId(identity.orgId),
      description,
      taskType: String(body.taskType || "").trim() || undefined,
      subTaskType: String(body.subTaskType || "").trim() || undefined,
      projectNo: normalizeReference(body.projectNo),
      workOrderNo: normalizeReference(body.workOrderNo),
      tenderNo: normalizeReference(body.tenderNo),
      createdBy: identity.userId,
      createdByEmpId: identity.empId,
      ...(assignees.length
        ? {
            status: "Assigned",
            assignedTo: assignees.map((assignee) => assignee._id),
            assignedToEmpIds: assignees.map((assignee) => assignee.username),
            assignedBy: identity.userId,
            assignedByEmpId: identity.empId,
            assignedAt: now,
          }
        : {}),
      orgId: identity.orgId,
    });

    for (const assignee of assignees) {
      await notifyTask({
        orgId: identity.orgId,
        recipientEmpId: assignee.username,
        employeeEmpId: identity.empId,
        type: "TASK_ASSIGNED",
        title: "New task assigned",
        message: `${task.taskId} was assigned to you: ${description.slice(0, 120)}`,
        dedupeKey: `${task._id}:assigned:${assignee.username}`,
      });
    }

    return Response.json({ message: "Task created successfully.", data: task }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create task.");
  }
}