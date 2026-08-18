import { NextResponse } from "next/server";

import connectDB from "@/lib/mongoose";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";
import User from "@/models/User";

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["ADMIN", "DIRECTOR"]);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({ orgId: identity.orgId }).select("-password").skip(skip).limit(limit),
      User.countDocuments({ orgId: identity.orgId }),
    ]);

    return NextResponse.json(
      { users, total, page, limit, totalPages: Math.ceil(total / limit) },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (error instanceof AttendanceError) return errorResponse(error);
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    await requireAttendanceUser(["ADMIN", "DIRECTOR"]);
    await request.json();
    return NextResponse.json(
      { message: "User created successfully" },

      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (error instanceof AttendanceError) return errorResponse(error);
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}
