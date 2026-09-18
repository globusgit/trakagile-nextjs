import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Break from "@/models/Break";
import Attendance from "@/models/Attendance";
import {
  AttendanceError,
  errorResponse,
  getActiveAttendance,
  requireAttendanceUser,
} from "../../_lib/attendance";

export async function POST(request) {
  let dbSession;
  try {
    await connectDB();
    dbSession = await mongoose.startSession();
    const identity = await requireAttendanceUser();

    const contentLength = request.headers?.get?.("content-length");
    if (contentLength != null) {
      const size = Number(contentLength);
      if (Number.isFinite(size) && size > 16 * 1024) {
        throw new AttendanceError("Request body exceeds the 16 KB size limit.", 413);
      }
    }
    const text = await request.text();
    if (Buffer.byteLength(text) > 16 * 1024) {
      throw new AttendanceError("Request body exceeds the 16 KB size limit.", 413);
    }
    try { JSON.parse(text); } catch { throw new AttendanceError("Invalid JSON body."); }

    const now = new Date();

    await dbSession.withTransaction(async () => {
      const attendance = await getActiveAttendance(identity.orgId, identity.empId, dbSession, true);
      if (!attendance) throw new AttendanceError("No active attendance found.", 404);

      if (!attendance.currentBreakId) {
        throw new AttendanceError("No break is currently in progress.", 409);
      }

      const activeBreak = await Break.findById(attendance.currentBreakId).session(dbSession);
      if (!activeBreak || activeBreak.status !== "ACTIVE") {
        throw new AttendanceError("No active break found for this attendance.", 409);
      }

      const durationMinutes = Math.max(
        0,
        Math.round((now.getTime() - new Date(activeBreak.startTime).getTime()) / 60000)
      );

      await Break.findByIdAndUpdate(
        activeBreak._id,
        {
          endTime: now,
          durationMinutes,
          status: "COMPLETED",
        },
        { session: dbSession, new: true }
      );

      await Attendance.findByIdAndUpdate(
        attendance._id,
        {
          // Query updates omit undefined values; explicitly remove the active break.
          $unset: { currentBreakId: 1, breakStartedAt: 1 },
          $inc: { totalBreakMinutes: durationMinutes },
        },
        { session: dbSession, new: true }
      );
    });

    return Response.json({ message: "Break ended.", endedAt: now });
  } catch (error) {
    return errorResponse(error, "Unable to end break.");
  } finally {
    await dbSession?.endSession();
  }
}
