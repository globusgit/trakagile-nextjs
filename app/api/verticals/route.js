import { connectDB } from "@/lib/mongoose";
import Vertical from "@/models/Vertical";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const rows = await Vertical.find({ orgId: identity.orgId }).sort({ name: 1 }).lean();
    const names = rows.map((vertical) => vertical.name);
    // `taskVerticals` is the older response key - kept so existing screens
    // (e.g. the Edit Task page) keep working unchanged.
    return Response.json({ verticals: names, taskVerticals: names });
  } catch (error) {
    return errorResponse(error, "Unable to load verticals.");
  }
}

// Any authenticated user can add a new Vertical - task creation is open
// to everyone, and someone creating a task may hit a new one.
export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) throw new AttendanceError("Vertical name is required.");

    const vertical = await Vertical.findOneAndUpdate(
      { orgId: identity.orgId, name },
      { $setOnInsert: { orgId: identity.orgId, name } },
      { upsert: true, new: true },
    );

    return Response.json({ message: "Vertical added.", data: vertical }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add vertical.");
  }
}