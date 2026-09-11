import TrackingLocation from "@/models/TrackingLocation";
import { cleanLocationTrack, latestLocation, locationTriggerPoints, trackLengthMeters } from "@/lib/locationTrack.mjs";

const DEFAULT_TRACK_LIMIT = 6000;

export async function attendanceTracks(orgId, attendances, options = {}) {
  if (!attendances.length) return new Map();
  const attendanceIds = attendances.map((attendance) => attendance._id);
  const limit = options.limit || DEFAULT_TRACK_LIMIT;

  const histories = await TrackingLocation.aggregate([
    { $match: { orgId, attendanceId: { $in: attendanceIds } } },
    { $sort: { capturedAt: -1, receivedAt: -1 } },
    { $group: { _id: "$attendanceId", points: { $push: "$$ROOT" } } },
    { $project: { points: { $slice: ["$points", limit] } } },
  ]);
  const pointsByAttendance = new Map(histories.map((history) => [String(history._id), history.points]));
  return new Map(attendances.map((attendance) => {
    const points = pointsByAttendance.get(String(attendance._id)) || [];
    const movementPoints = cleanLocationTrack(points);
    const lastKnown = attendance.lastKnownLocation && {
      ...attendance.lastKnownLocation,
      locationName: attendance.lastKnownLocationName || attendance.lastKnownLocation.locationName,
    };
    return [String(attendance._id), {
      location: latestLocation(points[0], lastKnown, attendance.markOut?.location, attendance.markIn?.location),
      triggerPoints: locationTriggerPoints(points.filter((point) => point.minuteTrigger || point.locationNameRefreshed), attendance.markIn?.location),
      movementPoints,
      filteredDistanceMeters: Math.round(trackLengthMeters(movementPoints)),
    }];
  }));
}
