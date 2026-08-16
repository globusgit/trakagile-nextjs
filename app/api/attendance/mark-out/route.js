import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import EmployeeVisit from "@/models/EmployeeVisit";
import TrackingLocation from "@/models/TrackingLocation";
import WorkFromHomeRequest from "@/models/WorkFromHomeRequest";
import {
  AttendanceError,
  dayKey,
  errorResponse,
  distanceBetween,
  getActiveAttendance,
  locationFrom,
  reliableDistance,
  requireAttendanceUser,
} from "../_lib/attendance";
import { notifyAttendance, reverseGeocode } from "../_lib/notifications";
import { assertBoundDevice, deviceFrom } from "../../wfh/_lib/device";
import { writeAudit } from "@/lib/audit";

export async function POST(request) {
  let dbSession;
  try {
    await connectDB();
    dbSession = await mongoose.startSession();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const now = new Date();
    const location = locationFrom(body, now);
    location.locationName = await reverseGeocode(location.latitude, location.longitude);
    let closedAttendance;

    await dbSession.withTransaction(async () => {
      const attendance = await getActiveAttendance(identity.orgId, identity.empId, dbSession, true);
      if (!attendance) throw new AttendanceError("No active attendance found.", 404);

      const activeVisit = await EmployeeVisit.exists({
        attendanceId: attendance._id,
        status: "IN_PROGRESS",
      }).session(dbSession);
      if (activeVisit) {
        throw new AttendanceError("Complete the active visit before marking out.", 409);
      }

      let wfhBreakMinutes = attendance.wfh?.totalBreakMinutes || 0;
      if (attendance.attendanceType === "WORK_FROM_HOME") {
        const device = deviceFrom(body, request);
        assertBoundDevice(attendance, device);
        const dailySummary = String(body.dailySummary || "").trim();
        if (!dailySummary) throw new AttendanceError("Daily work summary is required before WFH Mark Out.");
        const wfhRequest = await WorkFromHomeRequest.findById(attendance.wfhRequestId).session(dbSession);
        if (!wfhRequest) throw new AttendanceError("Approved WFH request is unavailable.", 409);
        const distance = distanceBetween(location, wfhRequest.workLocation);
        if (distance > wfhRequest.radiusMeters) throw new AttendanceError(`You are ${Math.round(distance)} m from the approved WFH location.`, 409);
        if (attendance.wfh?.breakStartedAt) wfhBreakMinutes += Math.max(0, Math.round((now.getTime() - attendance.wfh.breakStartedAt.getTime()) / 60000));
        attendance.set({ "wfh.breakStartedAt": undefined, "wfh.totalBreakMinutes": wfhBreakMinutes, "wfh.dailySummary": dailySummary, "wfh.pendingTasks": String(body.pendingTasks || "").trim(), "wfh.blockers": String(body.blockers || "").trim() });
        if (dayKey(now) >= wfhRequest.toDate) wfhRequest.status = "COMPLETED";
        await wfhRequest.save({ session: dbSession });
      }

      const totalWorkedMinutes = Math.max(
        0,
        Math.round((now.getTime() - attendance.markIn.time.getTime()) / 60000) - wfhBreakMinutes,
      );
      const finalDistanceMeters = reliableDistance(
        attendance.lastKnownLocation,
        location,
      );
      attendance.set({
        markOut: { time: now, location },
        lastKnownLocation: location,
        lastKnownLocationName: location.locationName,
        lastLocationReceivedAt: now,
        status: "OUT",
        trackingStatus: "STOPPED",
        totalWorkedMinutes,
        totalDistanceMeters:
          (attendance.totalDistanceMeters || 0) + finalDistanceMeters,
        closureType: "MANUAL",
        "overtime.active": false,
        "overtime.endedAt": attendance.overtime?.active ? now : undefined,
      });
      await attendance.save({ session: dbSession });
      closedAttendance = attendance;

      await TrackingLocation.create(
        [{
          attendanceId: attendance._id,
          employeeId: identity.empId,
          orgId: identity.orgId,
          ...location,
        }],
        { session: dbSession },
      );
    });

    await notifyAttendance({
      orgId: identity.orgId,
      empId: identity.empId,
      attendanceId: closedAttendance._id,
      type: "ATTENDANCE_COMPLETED",
      title: "Attendance completed",
      message: `${identity.empId} marked out. Distance: ${((closedAttendance.totalDistanceMeters || 0) / 1000).toFixed(2)} km.`,
      dedupeKey: `${closedAttendance._id}:attendance-completed`,
    });

    await writeAudit({ identity, action: "ATTENDANCE_MARK_OUT", entityType: "ATTENDANCE", entityId: closedAttendance._id, details: { workedMinutes: closedAttendance.totalWorkedMinutes, distanceMeters: closedAttendance.totalDistanceMeters } });

    return Response.json({ message: "Attendance marked out successfully." });
  } catch (error) {
    return errorResponse(error, "Unable to mark out.");
  } finally {
    await dbSession?.endSession();
  }
}
