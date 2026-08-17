import { connectDB } from "@/lib/mongoose";
import ActivityLog from "@/models/ActivityLog";
import { errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["ADMIN", "DIRECTOR"]);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25));
    const [logs, total] = await Promise.all([
      ActivityLog.find({ orgId: identity.orgId }).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ActivityLog.countDocuments({ orgId: identity.orgId }),
    ]);
    return Response.json({ logs, total, page, limit });
  } catch (error) { return errorResponse(error, "Unable to load audit logs."); }
}
