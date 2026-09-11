import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import {
  errorResponse,
  requireAttendanceUser,
} from "@/app/api/attendance/_lib/attendance";
import { createLogger } from "@/lib/logger.mjs";

const logger = createLogger("attendance-route");

export async function withAttendanceRoute(handler, options = {}) {
  const { roles, requireTransaction = false } = options;

  return async function wrapped(request) {
    let dbSession = null;
    try {
      await connectDB();
      const identity = await requireAttendanceUser(roles);

      if (requireTransaction) {
        dbSession = await mongoose.startSession();
      }

      const requestId = request.headers?.get?.("x-request-id") || undefined;
      const routeLogger = requestId
        ? logger.child({ requestId, empId: identity.empId })
        : logger.child({ empId: identity.empId });

      routeLogger.info("Attendance route invoked", {
        method: request.method,
        url: request.url,
      });

      const result = await handler(request, { identity, session: dbSession, logger: routeLogger });
      return result;
    } catch (error) {
      return errorResponse(error, "Attendance request failed.");
    } finally {
      if (dbSession) {
        await dbSession.endSession();
      }
    }
  };
}
