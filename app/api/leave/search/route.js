import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import mongoose from "mongoose";
import LeaveRequest from "@/models/LeaveRequest";
import User from "@/models/User";
import Employee from "@/models/Employee";

async function attachEmployeeNames(leaves, orgId) {
  const userIds = [...new Set(leaves.map((l) => l.userId?.toString()).filter(Boolean))];
  if (userIds.length === 0) return leaves;

  const users = await User.find({ _id: { $in: userIds } }).lean();
  const usernameByUserId = {};
  users.forEach((u) => {
    usernameByUserId[u._id.toString()] = u.username;
  });

  const empIds = [...new Set(Object.values(usernameByUserId).filter(Boolean))];
  const employees = await Employee.find({ empId: { $in: empIds }, orgId }).lean();
  const nameByEmpId = {};
  employees.forEach((e) => {
    nameByEmpId[e.empId] = e.name;
  });

  return leaves.map((leave) => {
    const uid = leave.userId?.toString();
    const empId = usernameByUserId[uid];
    const employeeName = empId ? nameByEmpId[empId] : undefined;
    return {
      ...leave,
      employeeName: employeeName || null,
    };
  });
}

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
      const term = search.trim();
      const regex = new RegExp(term, "i");

      query.$or = [
        { leaveType: regex },
        { status: regex },
        { reason: regex },
        { rejectionReason: regex },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$days" },
              regex: term,
              options: "i",
            },
          },
        },
      ];
    }

    const [rawLeaves, total] = await Promise.all([
      LeaveRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      LeaveRequest.countDocuments(query),
    ]);

    const leaves = await attachEmployeeNames(rawLeaves, orgId);

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