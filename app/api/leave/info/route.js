import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import mongoose from "mongoose";
import LeavesInfo from "@/models/LeavesInfo";

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const userId = searchParams.get("userId");
    const year = parseInt(searchParams.get("year")) || new Date().getFullYear();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const defaults = {
      userId,
      year,
      orgId,
      casual: 0,
      sick: 0,
      earned: 0,
      unpaid: 0,
      maternity: 0,
      paternity: 0,
      usedCasual: 0,
      usedSick: 0,
      usedEarned: 0,
      usedMaternity: 0,
      usedPaternity: 0,
    };

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(defaults, { status: 200 });
    }

    const info = await LeavesInfo.findOne({ userId, year, orgId });

    if (!info) {
      return NextResponse.json(defaults, { status: 200 });
    }

    return NextResponse.json(info, { status: 200 });
  } catch (error) {
    console.error("Error fetching leave info:", error);
    return NextResponse.json(
      { error: "Failed to fetch leave info" },
      { status: 500 },
    );
  }
}