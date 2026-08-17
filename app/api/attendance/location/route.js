import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
import TrackingLocation from "@/models/TrackingLocation";
import {
  AttendanceError,
  distanceBetween,
  errorResponse,
  getActiveAttendance,
  locationFrom,
  movementFrom,
  reliableDistance,
  requireAttendanceUser,
} from "../_lib/attendance";
import { notifyAttendance, reverseGeocode } from "../_lib/notifications";

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const now = new Date();
    const location = locationFrom(body, now);
    const movement = movementFrom(body);
    const attendance = await getActiveAttendance(identity.orgId, identity.empId);
    if (!attendance) throw new AttendanceError("No active attendance found.", 404);
    const distanceMeters = reliableDistance(attendance.lastKnownLocation, location);
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
    const shouldRefreshLocationName = !previousLocation?.locationName || movedSinceNamedLocation >= 500;
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

    await TrackingLocation.create({
      attendanceId: attendance._id,
      employeeId: identity.empId,
      visitId: visit?._id || null,
      orgId: identity.orgId,
      ...location,
      ...movement,
      locationName: locationName || undefined,
      locationNameRefreshed: Boolean(refreshedLocationName),
    });
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

    return Response.json({
      message: "Location updated.",
      location,
      receivedAt: now,
      distanceAddedMeters: distanceMeters,
      totalDistanceMeters: updatedAttendance?.totalDistanceMeters || 0,
      locationName,
    });
  } catch (error) {
    return errorResponse(error, "Unable to update location.");
  }
}
