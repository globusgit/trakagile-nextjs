import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import FieldTrip from "@/models/FieldTrip";
import TripEvent from "@/models/TripEvent";
import VisitedSite from "@/models/VisitedSite";
import { AttendanceError, distanceBetween, errorResponse, locationFrom, requireAttendanceUser } from "../../../attendance/_lib/attendance";
import { notifyAttendance, reverseGeocode } from "../../../attendance/_lib/notifications";

const transitions = {
  START_TRAVEL: { from: ["PLANNED"], to: "TRAVELLING" },
  ARRIVE_CLIENT: { from: ["TRAVELLING"], to: "AT_CLIENT" },
  START_WORK: { from: ["AT_CLIENT"], to: "WORKING" },
  END_SITE: { from: ["WORKING"], to: "SITE_COMPLETED" },
  STAY_CHECK_IN: { from: ["SITE_COMPLETED"], to: "STAYING" },
  STAY_CHECK_OUT: { from: ["STAYING"], to: "SITE_COMPLETED" },
  START_RETURN: { from: ["SITE_COMPLETED"], to: "RETURNING" },
  COMPLETE_TRIP: { from: ["RETURNING", "SITE_COMPLETED"], to: "COMPLETED" },
};

export async function POST(request, { params }) {
  let session;
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid trip.");
    const body = await request.json();
    const transition = transitions[body.action];
    if (!transition) throw new AttendanceError("Invalid trip action.");
    const now = new Date();
    const location = locationFrom(body, now);
    if (location.accuracy != null && location.accuracy > 500) throw new AttendanceError("GPS accuracy is too low. Move outdoors and retry.", 409);
    const attendance = await Attendance.findOne({ orgId: identity.orgId, empId: identity.empId, status: "IN" });
    if (!attendance) throw new AttendanceError("Active attendance is required for trip actions.", 409);
    const trip = await FieldTrip.findOne({ _id: id, orgId: identity.orgId, employeeId: identity.empId });
    if (!trip || !transition.from.includes(trip.status)) throw new AttendanceError("This action is not allowed in the current trip status.", 409);

    if (body.action === "ARRIVE_CLIENT") {
      const site = await VisitedSite.findById(trip.clientSiteId).lean();
      if (site?.location?.latitude != null && site?.location?.longitude != null) {
        const distance = distanceBetween(location, site.location);
        if (distance > (site.radiusMeters || 300)) throw new AttendanceError(`You are ${Math.round(distance)} m from the registered client/site.`, 409);
      }
    }
    if (body.action === "STAY_CHECK_IN" && (!String(body.hotelName || "").trim() || !body.expectedCheckOutAt)) throw new AttendanceError("Hotel name and expected checkout are required.");

    location.locationName = await reverseGeocode(location.latitude, location.longitude) || undefined;
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      trip.set({ status: transition.to, currentLocation: location });
      if (body.action === "START_TRAVEL") trip.startedAt = now;
      if (body.action === "STAY_CHECK_IN") trip.hotel = { name: String(body.hotelName).trim(), address: String(body.hotelAddress || "").trim(), expectedCheckOutAt: new Date(body.expectedCheckOutAt), checkInAt: now, checkInLocation: location };
      if (body.action === "STAY_CHECK_OUT") { trip.hotel.checkOutAt = now; trip.hotel.checkOutLocation = location; }
      if (body.action === "COMPLETE_TRIP") trip.completedAt = now;
      await trip.save({ session });
      await TripEvent.create([{ tripId: trip._id, orgId: identity.orgId, employeeId: identity.empId, type: body.action, location, remarks: String(body.remarks || "").trim(), metadata: body.action === "STAY_CHECK_IN" ? { hotelName: body.hotelName } : undefined }], { session });
    });
    const notificationTypes = {
      START_TRAVEL: ["TRAVEL_STARTED", "Travel started"],
      ARRIVE_CLIENT: ["SITE_REACHED", "Employee reached client/site"],
      END_SITE: ["VISIT_COMPLETED", "Site work completed"],
      STAY_CHECK_IN: ["HOTEL_CHECK_IN", "Hotel stay started"],
      STAY_CHECK_OUT: ["HOTEL_CHECK_OUT", "Hotel stay completed"],
      START_RETURN: ["TRAVEL_STARTED", "Return travel started"],
      COMPLETE_TRIP: ["TRIP_COMPLETED", "Field trip completed"],
    };
    const notification = notificationTypes[body.action];
    if (notification) await notifyAttendance({
      orgId: identity.orgId, empId: identity.empId, attendanceId: attendance._id,
      type: notification[0], title: notification[1],
      message: `${identity.empId}: ${notification[1]}${location.locationName ? ` near ${location.locationName}` : ""}.`,
      dedupeKey: `${trip._id}:${body.action}:${now.toISOString().slice(0, 16)}`,
    });
    return Response.json({ data: trip });
  } catch (error) { return errorResponse(error, "Unable to update field trip."); }
  finally { await session?.endSession(); }
}
