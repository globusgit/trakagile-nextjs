import mongoose from "mongoose";
import { NextResponse } from "next/server";

import connectDB from "@/lib/mongoose";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import User from "@/models/User";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.USER_MANAGE));
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const user = await User.findOne({ _id: id, orgId: identity.orgId }).select("-password").lean();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AttendanceError) return errorResponse(error);
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}
