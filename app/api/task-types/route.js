import { connectDB } from "@/lib/mongoose";
import TaskType from "@/models/TaskType";
import SubTaskType from "@/models/SubTaskType";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";
import { TASK_MANAGE_ROLES } from "../tasks/_lib/tasks";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const [types, subTypes] = await Promise.all([
      TaskType.find({ orgId: identity.orgId }).sort({ name: 1 }).lean(),
      SubTaskType.find({ orgId: identity.orgId }).sort({ name: 1 }).lean(),
    ]);

    const taskTypes = types.map((type) => ({
      name: type.name,
      subTypes: subTypes.filter((subType) => subType.taskType === type.name).map((subType) => subType.name),
    }));

    return Response.json({ taskTypes });
  } catch (error) {
    return errorResponse(error, "Unable to load task types.");
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(TASK_MANAGE_ROLES);
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) throw new AttendanceError("Task type name is required.");

    const taskType = await TaskType.findOneAndUpdate(
      { orgId: identity.orgId, name },
      { $setOnInsert: { orgId: identity.orgId, name } },
      { upsert: true, new: true },
    );

    return Response.json({ message: "Task type added.", data: taskType }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add task type.");
  }
}