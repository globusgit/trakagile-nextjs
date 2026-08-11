import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import mongoose from "mongoose";
import LeaveRequest from "@/models/LeaveRequest";

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const userId = searchParams.get("userId");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    const query = { orgId };
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = userId;
    }

    if (search && search.trim() !== "") {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { leaveType: regex },
        { status: regex },
        { reason: regex },
        { rejectionReason: regex },
      ];
    }

    const [leaves, total] = await Promise.all([
      LeaveRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      LeaveRequest.countDocuments(query),
    ]);

    return NextResponse.json(
      { leaves, page, limit, total, totalPages: Math.ceil(total / limit) },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error searching leave requests:", error);
    return NextResponse.json(
      { error: "Failed to search leave requests" },
      { status: 500 },
    );
  }
}