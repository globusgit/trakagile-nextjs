import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
import TrackingLocation from "@/models/TrackingLocation";
import {
  MAX_ACCURACY_MINUTE_TRIGGER,
  MAX_ACCURACY_STREAM,
  TRACKING_INTERVAL_MS,
  TRAVEL_START_DISTANCE,
  UNREALISTIC_SPEED_MPS,
} from "@/lib/trackingPolicy.mjs";
import {
  AttendanceError,
  attendanceExpectedEndAt,
  distanceBetween,
  getActiveAttendance,
  getAttendancePolicy,
  locationFrom,
  movementFrom,
  reliableDistance,
  requireAttendanceUser,
} from "../_lib/attendance";
import { notifyAttendance, reverseGeocode } from "../_lib/notifications";
import { closeAttendanceAfterNoResponse } from "../_lib/auto-close";
import { createLogger } from "@/lib/logger.mjs";

const logger = createLogger("location-ingest");

const BODY_SIZE_LIMIT_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;

const rateLimitStore = new Map();

function rateLimitKey(empId) {
  return `${empId}`;
}

function checkRateLimit(empId) {
  const key = rateLimitKey(empId);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function validateBodySize(request) {
  const contentLength = request.headers?.get?.("content-length");
  if (contentLength != null) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > BODY_SIZE_LIMIT_BYTES) {
      return new AttendanceError("Request body exceeds the 16 KB size limit.", 413);
    }
  }
  return null;
}

async function parseBody(request) {
  const text = await request.text();
  if (Buffer.byteLength(text) > BODY_SIZE_LIMIT_BYTES) {
    throw new AttendanceError("Request body exceeds the 16 KB size limit.", 413);
  }
  return JSON.parse(text);
}

// Clock-skew window: 24h offlineQueued allowance
//
// When a mobile device is offline, its queued location updates may be
// uploaded in a single burst after connectivity is restored.  The capturedAt
// timestamps inside that payload can lag far behind the server's wall-clock
// because the device's clock may drift, the OS may not update its RTC during
// airplane mode, and the device itself cannot know it is "offline" (that is a
// network-layer property).  Without a generous window these backlogged
// updates would be rejected by the normal 5-minute clock-skew guard.
//
// To prevent replay abuse we cap the window at 24h and only extend it for
// submissions that explicitly set offlineQueued=true.  This is a deliberate
// trade-off: it allows a compromised or rooted device to back-date at most
// 24h of history in a single upload, which is bounded by the server-side
// retention and already covered by the normal geofence / speed plausibility
// filters.
const OFFLINE_QUEUED_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

export async function POST(request) {
  let dbSession = null;
  try {
    await connectDB();
    dbSession = await mongoose.startSession();

    const identity = await requireAttendanceUser();

    const bodySizeError = validateBodySize(request);
    if (bodySizeError) throw bodySizeError;

    const body = await parseBody(request);
    const now = new Date();
    const requestId = request.headers?.get?.("x-request-id") || undefined;

    const rateLimitResult = checkRateLimit(identity.empId);
    if (!rateLimitResult.allowed) {
      logger.warn("Rate limit exceeded", { empId: identity.empId, requestId });
      return new Response(
        JSON.stringify({ message: "Rate limit exceeded. Please retry later." }),
        { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter), "Content-Type": "application/json" } },
      );
    }

    const location = locationFrom(body, now, {
      maxClockDifferenceMs: body.offlineQueued ? OFFLINE_QUEUED_CLOCK_SKEW_MS : 5 * 60 * 1000,
    });
    const heartbeatAt = new Date(Math.min(now.getTime(), location.capturedAt.getTime()));
    const movement = movementFrom(body);
    const clientPointId =
      typeof body.clientPointId === "string" && body.clientPointId.trim()
        ? body.clientPointId.trim().slice(0, 120)
        : undefined;

    const attendance = await getActiveAttendance(identity.orgId, identity.empId);
    if (!attendance) throw new AttendanceError("No active attendance found.", 404);
    if (attendance.markIn?.time && location.capturedAt < new Date(attendance.markIn.time)) {
      return Response.json({ accepted: false, reason: "BEFORE_MARK_IN" });
    }
    if (clientPointId) {
      const duplicate = await TrackingLocation.exists(
        { attendanceId: attendance._id, clientPointId },
        { session: dbSession },
      );
      if (duplicate) {
        return Response.json({
          message: "Location point was already received.",
          accepted: true,
          duplicate: true,
        });
      }
    }

    const minuteTrigger = !await TrackingLocation.exists(
      {
        attendanceId: attendance._id,
        minuteTrigger: true,
        capturedAt: { $gt: new Date(location.capturedAt.getTime() - TRACKING_INTERVAL_MS), $lte: location.capturedAt },
      },
      { session: dbSession },
    );
    if (!minuteTrigger) return Response.json({ accepted: true, routePoint: false, reason: "INTERVAL_NOT_DUE" });

    const maximumAcceptedAccuracy = minuteTrigger ? MAX_ACCURACY_MINUTE_TRIGGER : MAX_ACCURACY_STREAM;
    if (location.accuracy != null && location.accuracy > maximumAcceptedAccuracy) {
      return Response.json({ accepted: false, reason: "LOW_ACCURACY", message: `GPS point ignored because accuracy exceeded ${maximumAcceptedAccuracy} metres.` });
    }

    const distanceMeters = reliableDistance(attendance.lastKnownLocation, location);
    const historical = attendance.lastKnownLocation?.capturedAt &&
      new Date(attendance.lastKnownLocation.capturedAt) >= location.capturedAt;
    if (attendance.lastKnownLocation && !historical) {
      const previousTime = new Date(attendance.lastKnownLocation.capturedAt || attendance.lastLocationReceivedAt || now);
      const elapsedSeconds = (location.capturedAt.getTime() - previousTime.getTime()) / 1000;
      const rawDistanceMeters = distanceBetween(attendance.lastKnownLocation, location);
      if (elapsedSeconds <= 0 || distanceMeters / elapsedSeconds > UNREALISTIC_SPEED_MPS) {
        return Response.json({ accepted: false, reason: "UNREALISTIC_JUMP", message: "GPS point ignored because the movement was not physically plausible." });
      }
      const reportedStationary = movement.speed != null && movement.speed < 0.5;
      if (!minuteTrigger && (distanceMeters === 0 || (reportedStationary && rawDistanceMeters < TRAVEL_START_DISTANCE))) {
        await Attendance.updateOne(
          { _id: attendance._id, status: "IN" },
          { $set: { lastLocationReceivedAt: heartbeatAt, trackingStatus: "ACTIVE" } },
          { session: dbSession },
        );
        return Response.json({
          accepted: true,
          routePoint: false,
          reason: "STATIONARY",
          message: "GPS heartbeat received; stationary drift was excluded from the route.",
          totalDistanceMeters: attendance.totalDistanceMeters || 0,
        });
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
    const shouldRefreshLocationName = !previousLocation?.locationName || movedSinceNamedLocation >= LOCATION_NAME_REFRESH_DISTANCE;
    const refreshedLocationName = shouldRefreshLocationName
      ? await reverseGeocode(location.latitude, location.longitude)
      : null;
    const locationName = refreshedLocationName || previousLocation?.locationName || attendance.lastKnownLocationName;

    const visit = await EmployeeVisit.findOne({
      attendanceId: attendance._id,
      employeeId: identity.empId,
      orgId: identity.orgId,
      status: "IN_PROGRESS",
    }).session(dbSession);

    const lastCapturedAt = attendance.lastKnownLocation?.capturedAt
      ? new Date(attendance.lastKnownLocation.capturedAt)
      : null;
    const isHistorical = lastCapturedAt && lastCapturedAt >= location.capturedAt;

    await dbSession.withTransaction(async () => {
      try {
        await TrackingLocation.create(
          [{
            attendanceId: attendance._id,
            employeeId: identity.empId,
            visitId: visit?._id || null,
            orgId: identity.orgId,
            clientPointId,
            ...location,
            ...movement,
            locationName: locationName || undefined,
            locationNameRefreshed: Boolean(refreshedLocationName),
            minuteTrigger,
          }],
          { session: dbSession },
        );
      } catch (error) {
        if (error?.code === 11000 && clientPointId) {
          throw new AttendanceError("Location point was already received.", 409);
        }
        throw error;
      }

      if (!isHistorical) {
        await Attendance.findOneAndUpdate(
          { _id: attendance._id, status: "IN", $or: [
            { "lastKnownLocation.capturedAt": { $lt: location.capturedAt } },
            { "lastKnownLocation.capturedAt": { $exists: false } },
          ] },
          {
            $set: {
              lastKnownLocation: location,
              ...(locationName ? { lastKnownLocationName: locationName } : {}),
              lastLocationReceivedAt: heartbeatAt,
              trackingStatus: "ACTIVE",
            },
            $inc: { totalDistanceMeters: distanceMeters },
          },
          { new: true, session: dbSession },
        );
      }
    });

    if (isHistorical) {
      return Response.json({
        message: "Historical location point stored without replacing the live position.",
        accepted: true,
        historical: true,
        location,
        receivedAt: now,
        locationName,
      });
    }

    const notificationBase = {
      orgId: identity.orgId,
      empId: identity.empId,
      attendanceId: attendance._id,
    };
    if ((attendance.totalDistanceMeters || 0) < TRAVEL_START_DISTANCE && (attendance.totalDistanceMeters || 0) + distanceMeters >= TRAVEL_START_DISTANCE) {
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
    const expectedEndAt = attendanceExpectedEndAt(attendance, policy);
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
          attendance,
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
      totalDistanceMeters: attendance.totalDistanceMeters || 0,
      locationName,
      autoMarkedOut,
    });
  } catch (error) {
    if (error instanceof AttendanceError) {
      return Response.json({ message: error.message }, { status: error.status });
    }
    if (error?.code === 11000) {
      return Response.json({ message: "Location point was already received.", accepted: true, duplicate: true });
    }
    logger.error("Location ingestion error", { error: error?.message });
    return Response.json({ message: "Unable to update location." }, { status: 500 });
  } finally {
    if (dbSession) {
      await dbSession.endSession();
    }
  }
}
