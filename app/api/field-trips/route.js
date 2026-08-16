import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import FieldTrip from "@/models/FieldTrip";
import TripEvent from "@/models/TripEvent";
import TripExpense from "@/models/TripExpense";
import VisitedSite from "@/models/VisitedSite";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();
    const trips = await FieldTrip.find({ orgId, employeeId: empId })
      .populate("clientSiteId", "clientName siteName address location radiusMeters")
      .sort({ createdAt: -1 }).limit(20).lean();
    const active = trips.find((trip) => !["COMPLETED", "CANCELLED"].includes(trip.status));
    const events = active ? await TripEvent.find({ tripId: active._id }).sort({ createdAt: -1 }).lean() : [];
    const expenses = active ? await TripExpense.find({ tripId: active._id }).sort({ createdAt: -1 }).lean() : [];
    return Response.json({ trips, active: active || null, events, expenses });
  } catch (error) { return errorResponse(error, "Unable to load field trips."); }
}

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    if (!mongoose.isValidObjectId(body.clientSiteId)) throw new AttendanceError("Select a valid client/site.");
    const purpose = String(body.purpose || "").trim();
    const source = String(body.source || "").trim();
    const destination = String(body.destination || "").trim();
    const expectedStartAt = new Date(body.expectedStartAt);
    const expectedReturnAt = new Date(body.expectedReturnAt);
    const advanceAmount = Number(body.advanceAmount);
    if (!purpose || !source || !destination) throw new AttendanceError("Purpose, source and destination are required.");
    if (Number.isNaN(expectedStartAt.getTime()) || Number.isNaN(expectedReturnAt.getTime()) || expectedReturnAt <= expectedStartAt) throw new AttendanceError("Enter a valid trip period.");
    if (!Number.isFinite(advanceAmount) || advanceAmount < 0) throw new AttendanceError("Advance amount must be 0 or more.");
    const existing = await FieldTrip.exists({ orgId: identity.orgId, employeeId: identity.empId, status: { $nin: ["COMPLETED", "CANCELLED"] } });
    if (existing) throw new AttendanceError("Complete or cancel the current field trip first.", 409);
    const site = await VisitedSite.findOne({ _id: body.clientSiteId, orgId: identity.orgId, status: "ACTIVE" });
    if (!site) throw new AttendanceError("Client/site is unavailable.", 404);
    const attendance = await Attendance.findOne({ orgId: identity.orgId, empId: identity.empId, status: "IN" });
    const trip = await FieldTrip.create({
      orgId: identity.orgId, employeeId: identity.empId, attendanceId: attendance?._id,
      clientSiteId: site._id, purpose, source, destination,
      travelMode: body.travelMode, expectedStartAt, expectedReturnAt,
      advanceAmount,
    });
    return Response.json({ data: trip }, { status: 201 });
  } catch (error) { return errorResponse(error, "Unable to create field trip."); }
}
