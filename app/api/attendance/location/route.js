import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
import TrackingLocation from "@/models/TrackingLocation";
import {
  AttendanceError,
  attendanceExpectedEndAt,
  distanceBetween,
  errorResponse,
  getActiveAttendance,
  getAttendancePolicy,
  locationFrom,
  movementFrom,
  reliableDistance,
  requireAttendanceUser,
} from "../_lib/attendance";
import { notifyAttendance, reverseGeocode } from "../_lib/notifications";
import { closeAttendanceAfterNoResponse } from "../_lib/auto-close";

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const now = new Date();
    const location = locationFrom(body, now, {
      maxClockDifferenceMs: body.offlineQueued ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000,
    });
    const movement = movementFrom(body);
    const clientPointId =
      typeof body.clientPointId === "string" && body.clientPointId.trim()
        ? body.clientPointId.trim().slice(0, 120)
        : undefined;
    const attendance = await getActiveAttendance(identity.orgId, identity.empId);
    if (!attendance) throw new AttendanceError("No active attendance found.", 404);
    if (clientPointId) {
      const duplicate = await TrackingLocation.exists({
        attendanceId: attendance._id,
        clientPointId,
      });
      if (duplicate) {
        return Response.json({
          message: "Location point was already received.",
          accepted: true,
          duplicate: true,
        });
      }
    }
    const distanceMeters = reliableDistance(attendance.lastKnownLocation, location);
    if (location.accuracy != null && location.accuracy > 60) {
      return Response.json({ accepted: false, reason: "LOW_ACCURACY", message: "GPS point ignored because accuracy exceeded 60 metres." });
    }
    if (attendance.lastKnownLocation) {
      const previousTime = new Date(attendance.lastKnownLocation.capturedAt || attendance.lastLocationReceivedAt || now);
      const elapsedSeconds = Math.max(1, (location.capturedAt.getTime() - previousTime.getTime()) / 1000);
      if (elapsedSeconds <= 0 || distanceMeters / elapsedSeconds > 55) {
        return Response.json({ accepted: false, reason: "UNREALISTIC_JUMP", message: "GPS point ignored because the movement was not physically plausible." });
      }
      if (distanceMeters < 5 && elapsedSeconds < 30) {
        return Response.json({ accepted: false, reason: "DUPLICATE", message: "Duplicate location point ignored." });
      }
    }
    const previousLocation = await TrackingLocation.findOne({
      attendanceId: attendance._id,
      locationNameRefreshed: true,
    })
      .sort({ receivedAt: -1 })
      .select("locationName latitude longitude")
      .lean();
    const movedSinceNamedLocation = previousLocation
      ? distanceBetween(previousLocation, location)
      : Infinity;
    // Balance useful field-location triggers against reverse-geocoding every heartbeat.
    const shouldRefreshLocationName = !previousLocation?.locationName || movedSinceNamedLocation >= 250;
    const refreshedLocationName = shouldRefreshLocationName
      ? await reverseGeocode(location.latitude, location.longitude)
      : null;
    const locationName = refreshedLocationName || previousLocation?.locationName || attendance.lastKnownLocationName;

    const visit = await EmployeeVisit.findOne({
      attendanceId: attendance._id,
      employeeId: identity.empId,
      orgId: identity.orgId,
      status: "IN_PROGRESS",
    });

    try {
      await TrackingLocation.create({
        attendanceId: attendance._id,
        employeeId: identity.empId,
        visitId: visit?._id || null,
        orgId: identity.orgId,
        clientPointId,
        ...location,
        ...movement,
        locationName: locationName || undefined,
        locationNameRefreshed: Boolean(refreshedLocationName),
      });
    } catch (error) {
      if (error?.code === 11000 && clientPointId) {
        return Response.json({
          message: "Location point was already received.",
          accepted: true,
          duplicate: true,
        });
      }
      throw error;
    }

    const lastCapturedAt = attendance.lastKnownLocation?.capturedAt
      ? new Date(attendance.lastKnownLocation.capturedAt)
      : null;
    if (lastCapturedAt && lastCapturedAt >= location.capturedAt) {
      return Response.json({
        message: "Historical location point stored without replacing the live position.",
        accepted: true,
        historical: true,
        location,
        receivedAt: now,
        locationName,
      });
    }
    const updatedAttendance = await Attendance.findOneAndUpdate(
      { _id: attendance._id, status: "IN" },
      {
        $set: {
          lastKnownLocation: location,
          ...(locationName ? { lastKnownLocationName: locationName } : {}),
          lastLocationReceivedAt: now,
          trackingStatus: "ACTIVE",
        },
        $inc: { totalDistanceMeters: distanceMeters },
      },
      { new: true },
    );

    const notificationBase = {
      orgId: identity.orgId,
      empId: identity.empId,
      attendanceId: attendance._id,
    };
    if ((attendance.totalDistanceMeters || 0) < 100 && (attendance.totalDistanceMeters || 0) + distanceMeters >= 100) {
      await notifyAttendance({
        ...notificationBase,
        type: "TRAVEL_STARTED",
        title: "Employee travel started",
        message: `${identity.empId} is moving${locationName ? ` near ${locationName}` : ""}.`,
        dedupeKey: `${attendance._id}:travel-started`,
      });
    }
    if (attendance.expectedWorkEndAt && now > attendance.expectedWorkEndAt && (movement.speed == null || movement.speed < 2)) {
      await notifyAttendance({
        ...notificationBase,
        type: "POSSIBLE_DELAY",
        title: "Possible field-work delay",
        message: `${identity.empId} is past the expected completion time. This is movement-based, not confirmed traffic data.`,
        dedupeKey: `${attendance._id}:possible-delay`,
      });
    }

    const policy = await getAttendancePolicy(identity.orgId);
    const expectedEndAt = attendanceExpectedEndAt(updatedAttendance || attendance, policy);
    const responseMinutes = Number(policy.markOutResponseMinutes) || 15;
    let autoMarkedOut = false;
    if (now >= expectedEndAt) {
      await notifyAttendance({
        ...notificationBase,
        type: "POSSIBLE_DELAY",
        title: "Your Mark Out time has arrived",
        message: `Mark Out now or choose Continue Working. With no response, attendance closes automatically after ${responseMinutes} minutes.`,
        dedupeKey: `${attendance._id}:mark-out-response:${expectedEndAt.toISOString()}`,
      });
      if (now >= new Date(expectedEndAt.getTime() + responseMinutes * 60000)) {
        autoMarkedOut = await closeAttendanceAfterNoResponse(
          updatedAttendance || attendance,
          now,
          `No response within ${responseMinutes} minutes after the expected Mark Out time.`,
        );
      }
    }

    return Response.json({
      message: "Location updated.",
      accepted: true,
      location,
      receivedAt: now,
      distanceAddedMeters: distanceMeters,
      totalDistanceMeters: updatedAttendance?.totalDistanceMeters || 0,
      locationName,
      autoMarkedOut,
    });
  } catch (error) {
    return errorResponse(error, "Unable to update location.");
  }
}
