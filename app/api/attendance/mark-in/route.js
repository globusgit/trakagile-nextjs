import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
import TrackingLocation from "@/models/TrackingLocation";
import VisitedSite from "@/models/VisitedSite";
import WorkFromHomeRequest from "@/models/WorkFromHomeRequest";
import {
  AttendanceError,
  dayKey,
  distanceBetween,
  errorResponse,
  getEmployee,
  getAttendancePolicy,
  locationFrom,
  minutesInTimeZone,
  requireAttendanceUser,
} from "../_lib/attendance";
import { notifyAttendance } from "../_lib/notifications";
import { deviceFrom } from "../../wfh/_lib/device";
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
    const attendanceType = ["FIELD_VISIT", "WORK_FROM_HOME"].includes(body.attendanceType)
      ? body.attendanceType
      : "OFFICE";
    const purpose = String(body.purpose || "").trim();
    const expectedWorkEndAt = body.expectedWorkEndAt
      ? new Date(body.expectedWorkEndAt)
      : null;
    const policy = await getAttendancePolicy(identity.orgId);

    if (attendanceType === "FIELD_VISIT") {
      if (!mongoose.isValidObjectId(body.clientSiteId)) {
        throw new AttendanceError("Select a valid client/site for field work.", 400);
      }
      if (!purpose) throw new AttendanceError("Enter the field visit purpose.", 400);
      if (!expectedWorkEndAt || Number.isNaN(expectedWorkEndAt.getTime()) || expectedWorkEndAt <= now) {
        throw new AttendanceError("Expected completion time must be in the future.", 400);
      }
      if (expectedWorkEndAt.getTime() - now.getTime() > 48 * 60 * 60 * 1000) {
        throw new AttendanceError("Expected completion cannot be more than 48 hours away.", 400);
      }
    }
    let attendance;
    let approvedWfh = null;
    const wfhDevice = attendanceType === "WORK_FROM_HOME" ? deviceFrom(body, request) : null;

    if (attendanceType === "WORK_FROM_HOME") {
      const today = dayKey(now);
      approvedWfh = await WorkFromHomeRequest.findOne({
        orgId: identity.orgId, employeeId: identity.empId, status: "APPROVED",
        fromDate: { $lte: today }, toDate: { $gte: today },
      });
      if (!approvedWfh) throw new AttendanceError("No approved WFH request is available for today.", 403);
      const distance = distanceBetween(location, approvedWfh.workLocation);
      if (distance > approvedWfh.radiusMeters) {
        throw new AttendanceError(`You are ${Math.round(distance)} m from the approved WFH location.`, 409);
      }
    }

    await dbSession.withTransaction(async () => {
      const employee = await getEmployee(identity.orgId, identity.empId, dbSession);
      const active = await Attendance.exists({
        orgId: identity.orgId,
        empId: identity.empId,
        status: "IN",
      }).session(dbSession);
      if (active) throw new AttendanceError("You already have an active attendance.", 409);

      let site = null;
      if (attendanceType === "FIELD_VISIT") {
        site = await VisitedSite.findOne({
          _id: body.clientSiteId,
          orgId: identity.orgId,
          status: "ACTIVE",
        }).session(dbSession);
        if (!site) throw new AttendanceError("The selected client/site is unavailable.", 404);
      }

      const [created] = await Attendance.create(
        [{
          empObjId: employee._id,
          empId: identity.empId,
          orgId: identity.orgId,
          attendanceDate: dayKey(now),
          markIn: { time: now, location },
          lastKnownLocation: location,
          lastLocationReceivedAt: now,
          attendanceType,
          isEarlyStart: minutesInTimeZone(now, policy.timeZone) < policy.shiftStartMinutes,
          expectedWorkEndAt: attendanceType === "FIELD_VISIT" ? expectedWorkEndAt : undefined,
          overnightWork: attendanceType === "FIELD_VISIT" && body.overnightWork === true,
          wfhRequestId: approvedWfh?._id,
          wfhDevice: wfhDevice ? { ...wfhDevice, boundAt: now, lastSeenAt: now } : undefined,
          totalVisits: site ? 1 : 0,
        }],
        { session: dbSession },
      );
      attendance = created;

      await TrackingLocation.create(
        [{
          attendanceId: created._id,
          employeeId: identity.empId,
          orgId: identity.orgId,
          ...location,
        }],
        { session: dbSession },
      );

      if (site) {
        await EmployeeVisit.create(
          [{
            attendanceId: created._id,
            employeeId: identity.empId,
            clientSiteId: site._id,
            orgId: identity.orgId,
            purpose,
            startTime: now,
            startLocation: location,
          }],
          { session: dbSession },
        );
      }
    });

    if (attendanceType === "FIELD_VISIT") {
      await notifyAttendance({
        orgId: identity.orgId,
        empId: identity.empId,
        attendanceId: attendance._id,
        type: "TRAVEL_STARTED",
        title: "Field visit started",
        message: `${identity.empId} marked in for field work. Expected completion: ${expectedWorkEndAt.toLocaleString("en-IN", { timeZone: policy.timeZone })}.`,
        dedupeKey: `${attendance._id}:field-started`,
      });
    }

    await writeAudit({ identity, action: "ATTENDANCE_MARK_IN", entityType: "ATTENDANCE", entityId: attendance._id, details: { attendanceType, attendanceDate: attendance.attendanceDate } });

    return Response.json({ data: attendance }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to mark in.");
  } finally {
    await dbSession?.endSession();
  }
}
