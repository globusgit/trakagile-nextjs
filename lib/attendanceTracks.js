import TrackingLocation from "@/models/TrackingLocation";
import { cleanLocationTrack, latestLocation, locationTriggerPoints, trackLengthMeters } from "@/lib/locationTrack.mjs";

// Both map screens use the same records and distance filtering per attendance.
export async function attendanceTracks(orgId, attendances) {
  if (!attendances.length) return new Map();
  const histories = await TrackingLocation.aggregate([
    { $match: { orgId, attendanceId: { $in: attendances.map((attendance) => attendance._id) } } },
    { $sort: { capturedAt: -1, receivedAt: -1 } },
    { $group: { _id: "$attendanceId", points: { $push: "$$ROOT" } } },
    { $project: { points: { $slice: ["$points", 6000] } } },
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
