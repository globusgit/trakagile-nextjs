import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import mongoose from "mongoose";
import LeaveRequest from "@/models/LeaveRequest";

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const userId = searchParams.get("userId"); // scopes results to one employee
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    const query = { orgId };
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = userId;
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
    console.error("Error fetching leave requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch leave requests" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { userId, leaveType, startDate, endDate, days, reason, orgId } = body;

    // Once auth exists, userId will always come from the logged-in
    // session — no fallback/auto-generation needed at that point.
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "A valid userId is required to submit a leave request." },
        { status: 400 },
      );
    }

    const leave = new LeaveRequest({
      userId,
      leaveType,
      startDate,
      endDate,
      days,
      reason,
      orgId,
      status: "pending",
    });

    await leave.save();
    return NextResponse.json("Leave request submitted successfully!", { status: 201 });
  } catch (error) {
    console.error("Error creating leave request:", error);
    return NextResponse.json(
      { error: "Failed to submit leave request" },
      { status: 500 },
    );
  }
}