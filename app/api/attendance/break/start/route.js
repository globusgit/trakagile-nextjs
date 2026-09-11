import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Break from "@/models/Break";
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
    let body;
    try { body = JSON.parse(text); } catch { throw new AttendanceError("Invalid JSON body."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AttendanceError("Request body must be an object.");
    }

    const now = new Date();
    const breakType = ["LUNCH", "TEA", "PERSONAL"].includes(body.breakType)
      ? body.breakType
      : "OTHER";
    const reason = String(body.reason || "").trim();

    await dbSession.withTransaction(async () => {
      const attendance = await getActiveAttendance(identity.orgId, identity.empId, dbSession, true);
      if (!attendance) throw new AttendanceError("No active attendance found.", 404);

      if (attendance.currentBreakId) {
        const activeBreak = await Break.findById(attendance.currentBreakId).session(dbSession);
        if (activeBreak && activeBreak.status === "ACTIVE") {
          throw new AttendanceError("A break is already in progress. End it before starting a new one.", 409);
        }
      }

      const [created] = await Break.create(
        [{
          attendanceId: attendance._id,
          employeeId: identity.empId,
          orgId: identity.orgId,
          breakType,
          reason,
          startTime: now,
          status: "ACTIVE",
        }],
        { session: dbSession }
      );

      await Attendance.findByIdAndUpdate(
        attendance._id,
        {
          currentBreakId: created._id,
          breakStartedAt: now,
        },
        { session: dbSession, new: true }
      );
    });

    return Response.json({ message: "Break started.", startedAt: now });
  } catch (error) {
    return errorResponse(error, "Unable to start break.");
  } finally {
    await dbSession?.endSession();
  }
}
