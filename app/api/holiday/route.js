import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Holiday from "@/models/Holiday";
import { errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

// Roles allowed to create/manage holidays.
const HOLIDAY_MANAGE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER"];

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year"));
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 10));
    const skip = (page - 1) * limit;

    const query = { orgId: identity.orgId };
    if (!isNaN(year)) {
      query.year = year;
    }
    const [holidays, total] = await Promise.all([
      Holiday.find(query).skip(skip).limit(limit),
      Holiday.countDocuments(query),
    ]);

    return NextResponse.json(
      {
        holidays,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error?.name === "AttendanceError") return errorResponse(error);
    console.error("Error fetching holidays:", error);
    return NextResponse.json(
      { error: "Failed to fetch holidays" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(HOLIDAY_MANAGE_ROLES);

    const body = await request.json();
    const { name, date, year, note, isRecurring, isOptional } = body;

    const holiday = new Holiday({
      name,
      date,
      isRecurring: isRecurring === true || isRecurring === "true",
      isOptional: isOptional === true || isOptional === "true",
      year: year ? year : new Date().getFullYear(),
      note,
      // Always use the logged-in user's own org — never trust orgId from the client body.
      orgId: identity.orgId,
    });
    await holiday.save();
    return NextResponse.json("Holiday added successfully!", { status: 201 });
  } catch (error) {
    if (error?.name === "AttendanceError") return errorResponse(error);
    console.error("Error creating holiday:", error);
    return NextResponse.json(
      { error: "Failed to create holiday" },
      { status: 500 },
    );
  }
}
