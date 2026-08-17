import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Employee from "@/models/Employee";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.empId) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    await connectDB();

    const employee = await Employee.findOne({
      empId: session.user.empId,
      orgId: session.user.orgId,
    }).select("name empId email photo designation isManager");

    if (!employee) {
      return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json(employee, { status: 200 });
  } catch (err) {
    console.error("Error fetching current employee:", err);
    return NextResponse.json(
      { message: "Failed to fetch employee" },
      { status: 500 },
    );
  }
}