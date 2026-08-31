import { connectDB } from "@/lib/mongoose";
import TaskType from "@/models/TaskType";
import SubTaskType from "@/models/SubTaskType";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { TASK_MANAGE_ROLES } from "../../tasks/_lib/tasks";

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(TASK_MANAGE_ROLES);
    const body = await request.json();
    const taskType = String(body.taskType || "").trim();
    const name = String(body.name || "").trim();
    if (!taskType) throw new AttendanceError("Select a task type first.");
    if (!name) throw new AttendanceError("Sub-task type name is required.");

    const parentExists = await TaskType.exists({ orgId: identity.orgId, name: taskType });
    if (!parentExists) throw new AttendanceError("Selected task type no longer exists.");

    const subTaskType = await SubTaskType.findOneAndUpdate(
      { orgId: identity.orgId, taskType, name },
      { $setOnInsert: { orgId: identity.orgId, taskType, name } },
      { upsert: true, new: true },
    );

    return Response.json({ message: "Sub-task type added.", data: subTaskType }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add sub-task type.");
  }
}