import { connectDB } from "@/lib/mongoose";
import TaskType from "@/models/TaskType";
import SubTaskType from "@/models/SubTaskType";
import { TASK_SOURCES } from "@/models/Task";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

// GET /api/task-types?taskSource=IT&taskVertical=Highways
// Returns the Task Types (with nested Sub-Task Types) available under a given
// point in the Task Source -> Task Vertical (Project only) -> Task Type ->
// Sub-Task Type hierarchy. Empty until the caller has picked a valid scope.
export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const taskSource = searchParams.get("taskSource")?.trim() || "";
    const taskVertical = searchParams.get("taskVertical")?.trim() || "";

    if (!TASK_SOURCES.includes(taskSource) || (taskSource === "Project" && !taskVertical)) {
      return Response.json({ taskTypes: [] });
    }

    const scopeQuery = { orgId: identity.orgId, taskSource };
    scopeQuery.taskVertical = taskSource === "Project" ? taskVertical : { $exists: false };

    const [types, subTypes] = await Promise.all([
      TaskType.find(scopeQuery).sort({ name: 1 }).lean(),
      SubTaskType.find(scopeQuery).sort({ name: 1 }).lean(),
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

// Any authenticated user can add a new Task Type - task creation is now open
// to everyone, and someone self-creating a task may hit a genuinely new type.
export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const taskSource = String(body.taskSource || "").trim();
    const taskVertical = String(body.taskVertical || "").trim();

    if (!TASK_SOURCES.includes(taskSource)) throw new AttendanceError("Select a valid task source first.");
    if (taskSource === "Project" && !taskVertical) throw new AttendanceError("Select a task vertical first.");
    if (!name) throw new AttendanceError("Task type name is required.");

    const scopeQuery = { orgId: identity.orgId, taskSource };
    scopeQuery.taskVertical = taskSource === "Project" ? taskVertical : { $exists: false };

    const taskType = await TaskType.findOneAndUpdate(
      { ...scopeQuery, name },
      {
        $setOnInsert: {
          orgId: identity.orgId,
          taskSource,
          name,
          ...(taskSource === "Project" ? { taskVertical } : {}),
        },
      },
      { upsert: true, new: true },
    );

    return Response.json({ message: "Task type added.", data: taskType }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add task type.");
  }
}