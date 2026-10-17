import { connectDB } from "@/lib/mongoose";
import SubVertical from "@/models/SubVertical";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

// GET /api/sub-verticals?vertical=<name> -> sub-verticals under that vertical.
export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const vertical = searchParams.get("vertical")?.trim() || "";
    if (!vertical) return Response.json({ subVerticals: [] });

    const subVerticals = await SubVertical.find({ orgId: identity.orgId, vertical }).sort({ name: 1 }).lean();
    return Response.json({ subVerticals: subVerticals.map((entry) => entry.name) });
  } catch (error) {
    return errorResponse(error, "Unable to load sub-verticals.");
  }
}

// Any authenticated user can add a new sub-vertical - same rule as verticals,
// since task creation is open to everyone.
export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const vertical = String(body.vertical || "").trim();
    const name = String(body.name || "").trim();
    if (!vertical) throw new AttendanceError("Select a vertical first.");
    if (!name) throw new AttendanceError("Sub-vertical name is required.");

    const subVertical = await SubVertical.findOneAndUpdate(
      { orgId: identity.orgId, vertical, name },
      { $setOnInsert: { orgId: identity.orgId, vertical, name } },
      { upsert: true, new: true },
    );

    return Response.json({ message: "Sub-vertical added.", data: subVertical }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add sub-vertical.");
  }
}