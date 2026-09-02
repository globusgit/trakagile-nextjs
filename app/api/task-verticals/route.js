import { connectDB } from "@/lib/mongoose";
import TaskVertical from "@/models/TaskVertical";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const verticals = await TaskVertical.find({ orgId: identity.orgId }).sort({ name: 1 }).lean();
    return Response.json({ taskVerticals: verticals.map((vertical) => vertical.name) });
  } catch (error) {
    return errorResponse(error, "Unable to load task verticals.");
  }
}

// Any authenticated user can add a new Task Vertical - task creation is open
// to everyone, and someone self-creating a Project task may hit a new one.
export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) throw new AttendanceError("Task vertical name is required.");

    const taskVertical = await TaskVertical.findOneAndUpdate(
      { orgId: identity.orgId, name },
      { $setOnInsert: { orgId: identity.orgId, name } },
      { upsert: true, new: true },
    );

    return Response.json({ message: "Task vertical added.", data: taskVertical }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add task vertical.");
  }
}