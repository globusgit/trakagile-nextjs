import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongoose";
import Holiday from "@/models/Holiday";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";

// Roles allowed to create/manage holidays — keep in sync with
// HOLIDAY_MANAGE_ROLES in app/api/holiday/route.js and the holidays pages.
const HOLIDAY_MANAGE_ROLES = rolesForPermission(PERMISSIONS.HOLIDAY_MANAGE);

async function scopedHoliday(id, orgId) {
  if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid holiday.");
  const holiday = await Holiday.findOne({ _id: id, orgId });
  if (!holiday) throw new AttendanceError("Holiday not found.", 404);
  return holiday;
}

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    const holiday = await scopedHoliday(id, identity.orgId);
    return NextResponse.json(holiday);
  } catch (error) {
    if (error?.name === "AttendanceError") return errorResponse(error, "Unable to load holiday.");
    console.error("Error fetching holiday:", error);
    return NextResponse.json({ message: "Unable to load holiday." }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(HOLIDAY_MANAGE_ROLES);
    const { id } = await params;
    const holiday = await scopedHoliday(id, identity.orgId);

    const body = await request.json();
    const { name, date, year, note, isRecurring, isOptional } = body;

    if (!String(name || "").trim()) throw new AttendanceError("Holiday name is required.");
    if (!date || Number.isNaN(new Date(date).getTime())) throw new AttendanceError("Enter a valid date.");

    holiday.name = String(name).trim();
    holiday.date = date;
    holiday.isRecurring = isRecurring === true || isRecurring === "true";
    holiday.isOptional = isOptional === true || isOptional === "true";
    holiday.year = year ? Number(year) : holiday.year;
    holiday.note = note ?? "";

    await holiday.save();
    return NextResponse.json(holiday);
  } catch (error) {
    if (error?.name === "AttendanceError") return errorResponse(error, "Unable to update holiday.");
    console.error("Error updating holiday:", error);
    return NextResponse.json({ message: "Failed to update holiday" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(HOLIDAY_MANAGE_ROLES);
    const { id } = await params;
    const holiday = await scopedHoliday(id, identity.orgId);
    await holiday.deleteOne();
    return NextResponse.json({ message: "Holiday deleted." });
  } catch (error) {
    if (error?.name === "AttendanceError") return errorResponse(error, "Unable to delete holiday.");
    console.error("Error deleting holiday:", error);
    return NextResponse.json({ message: "Failed to delete holiday" }, { status: 500 });
  }
}
