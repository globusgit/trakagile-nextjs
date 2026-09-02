import { connectDB } from "@/lib/mongoose";
import TaskType from "@/models/TaskType";
import SubTaskType from "@/models/SubTaskType";
import { TASK_SOURCES } from "@/models/Task";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const taskSource = String(body.taskSource || "").trim();
    const taskVertical = String(body.taskVertical || "").trim();
    const taskType = String(body.taskType || "").trim();
    const name = String(body.name || "").trim();

    if (!TASK_SOURCES.includes(taskSource)) throw new AttendanceError("Select a valid task source first.");
    if (taskSource === "Project" && !taskVertical) throw new AttendanceError("Select a task vertical first.");
    if (!taskType) throw new AttendanceError("Select a task type first.");
    if (!name) throw new AttendanceError("Sub-task type name is required.");

    const scopeQuery = { orgId: identity.orgId, taskSource, taskType };
    scopeQuery.taskVertical = taskSource === "Project" ? taskVertical : { $exists: false };

    const parentExists = await TaskType.exists({
      orgId: identity.orgId,
      taskSource,
      taskVertical: taskSource === "Project" ? taskVertical : { $exists: false },
      name: taskType,
    });
    if (!parentExists) throw new AttendanceError("Selected task type no longer exists.");

    const subTaskType = await SubTaskType.findOneAndUpdate(
      { ...scopeQuery, name },
      {
        $setOnInsert: {
          orgId: identity.orgId,
          taskSource,
          taskType,
          name,
          ...(taskSource === "Project" ? { taskVertical } : {}),
        },
      },
      { upsert: true, new: true },
    );

    return Response.json({ message: "Sub-task type added.", data: subTaskType }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add sub-task type.");
  }
}