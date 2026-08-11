import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Employee from "@/models/Employee";

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const q = searchParams.get("q");
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    const query = { orgId };

    if (q && q.trim() !== "") {
      const regex = new RegExp(q.trim(), "i");
      query.$or = [
        { name: regex },
        { empId: regex },
        { email: regex },
        { phone: regex },
        { designation: regex },
        { reportingManager: regex },
        { status: regex },
      ];
    }

    const [employees, total] = await Promise.all([
      Employee.find(query).skip(skip).limit(limit),
      Employee.countDocuments(query),
    ]);

    return NextResponse.json(
      { employees, page, limit, total },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error searching employees:", error);
    return NextResponse.json(
      { error: "Failed to search employees" },
      { status: 500 },
    );
  }
}