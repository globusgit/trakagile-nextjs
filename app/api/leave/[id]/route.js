import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import LeaveRequest from "@/models/LeaveRequest";

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const leave = await LeaveRequest.findById(id);

    if (!leave) {
      return NextResponse.json({ message: "Leave request not found" }, { status: 404 });
    }

    return NextResponse.json(leave, { status: 200 });
  } catch (error) {
    console.error("Error fetching leave request:", error);
    return NextResponse.json(
      { message: "Failed to fetch leave request" },
      { status: 500 },
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const existing = await LeaveRequest.findById(id);
    if (!existing) {
      return NextResponse.json({ message: "Leave request not found" }, { status: 404 });
    }

    const action = body.action;

    // --- Employee cancels a still-pending leave (no admin approval needed,
    // since nothing has been decided on yet) ---
    if (action === "cancel_pending") {
      if (existing.status !== "pending") {
        return NextResponse.json(
          { message: "Only pending leave requests can be cancelled this way." },
          { status: 403 },
        );
      }
      existing.status = "cancelled";
      existing.cancellationReason = body.cancellationReason || "";
      existing.cancellationRequestedAt = new Date();
      await existing.save();
      return NextResponse.json("Leave request cancelled.", { status: 200 });
    }

    // --- Employee requests cancellation of an already-approved leave ---
    if (action === "request_cancellation") {
      if (existing.status !== "approved") {
        return NextResponse.json(
          { message: "Only approved leave requests can have a cancellation requested." },
          { status: 403 },
        );
      }
      existing.status = "cancellation_pending";
      existing.cancellationReason = body.cancellationReason || "";
      existing.cancellationRequestedAt = new Date();
      await existing.save();
      return NextResponse.json("Cancellation requested successfully.", { status: 200 });
    }

    // --- Admin approves the cancellation request (finalizes it) ---
    // TODO: gate this to admin role only once auth/roles exist
    if (action === "approve_cancellation") {
      if (existing.status !== "cancellation_pending") {
        return NextResponse.json(
          { message: "This request does not have a pending cancellation." },
          { status: 403 },
        );
      }
      existing.status = "cancelled";
      await existing.save();
      return NextResponse.json("Cancellation approved.", { status: 200 });
    }

    // --- Admin rejects the cancellation request (leave stays approved) ---
    // TODO: gate this to admin role only once auth/roles exist
    if (action === "reject_cancellation") {
      if (existing.status !== "cancellation_pending") {
        return NextResponse.json(
          { message: "This request does not have a pending cancellation." },
          { status: 403 },
        );
      }
      existing.status = "approved";
      existing.cancellationDecisionReason = body.cancellationDecisionReason || "";
      await existing.save();
      return NextResponse.json("Cancellation request rejected. Leave remains approved.", { status: 200 });
    }

    // --- Normal field edit (only allowed while still pending) ---
    if (existing.status !== "pending") {
      return NextResponse.json(
        { message: `This request is already ${existing.status} and can no longer be edited.` },
        { status: 403 },
      );
    }

    const { leaveType, startDate, endDate, days, reason } = body;

    existing.leaveType = leaveType;
    existing.startDate = startDate;
    existing.endDate = endDate;
    existing.days = days;
    existing.reason = reason;

    await existing.save();

    return NextResponse.json("Leave request updated successfully!", { status: 200 });
  } catch (error) {
    console.error("Error updating leave request:", error);
    return NextResponse.json(
      { message: "Failed to update leave request" },
      { status: 500 },
    );
  }
}