import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Employee from "@/models/Employee";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { visibleEmployeeIds } from "@/lib/access";
import { escapeRegex, pagination } from "@/lib/query.mjs";

export async function GET(request) {
  try {
    await connectDB();
    // HR included so HR can look up employees to assign tasks to (Tasks module).
    const identity = await requireAttendanceUser(["ADMIN", "DIRECTOR", "MANAGER", "HR"]);
    const { searchParams } = new URL(request.url);
    const orgId = identity.orgId;
    const q = searchParams.get("q");
    const { page, limit } = pagination(searchParams);
    const skip = (page - 1) * limit;

    const allowedIds = await visibleEmployeeIds(identity);
    const query = { orgId, ...(allowedIds ? { empId: { $in: allowedIds } } : {}) };

    if (q && q.trim() !== "") {
      const regex = new RegExp(escapeRegex(q.trim()), "i");
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
    if (error?.name === "AttendanceError") return errorResponse(error);
    console.error("Error searching employees:", error.message);
    
    // Check if it's a MongoDB connection error
    if (error.message.includes("MongoDB connection failed")) {
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "MongoDB Atlas connection failed. See MONGODB_TROUBLESHOOTING.md for help.",
          employees: [],
          page: 1,
          limit: 10,
          total: 0,
        },
        { status: 503 }, // Service Unavailable
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to search employees",
        employees: [],
        page: 1,
        limit: 10,
        total: 0,
      },
      { status: 500 },
    );
  }
}