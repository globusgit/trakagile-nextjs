import { connectDB } from "@/lib/mongoose";
import Break from "@/models/Break";
import { errorResponse, getActiveAttendance, requireAttendanceUser } from "../_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();

    const attendance = await getActiveAttendance(identity.orgId, identity.empId);
    if (!attendance) {
      return Response.json({ onBreak: false, break: null });
    }

    if (!attendance.currentBreakId) {
      return Response.json({ onBreak: false, break: null });
    }

    const activeBreak = await Break.findById(attendance.currentBreakId).lean();
    if (!activeBreak || activeBreak.status !== "ACTIVE") {
      return Response.json({ onBreak: false, break: null });
    }

    const elapsedMinutes = Math.max(
      0,
      Math.round((Date.now() - new Date(activeBreak.startTime).getTime()) / 60000)
    );

    return Response.json({
      onBreak: true,
      break: {
        _id: activeBreak._id,
        breakType: activeBreak.breakType,
        reason: activeBreak.reason,
        startTime: activeBreak.startTime,
        elapsedMinutes,
      },
    });
  } catch (error) {
    return errorResponse(error, "Unable to load break status.");
  }
}
