import bcrypt from "bcryptjs";

import connectDB from "@/lib/mongoose";
import { createMobileToken } from "@/lib/mobileAuth";
import Employee from "@/models/Employee";
import User from "@/models/User";

export async function POST(request) {
  try {
    const body = await request.json();
    const empId = String(body.empId || "").trim();
    const password = String(body.password || "");
    if (!empId || !password) {
      return Response.json({ message: "Employee ID and password are required." }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ username: empId }).lean();
    if (!user || user.status !== "Active" || !user.password || !(await bcrypt.compare(password, user.password))) {
      return Response.json({ message: "Invalid employee ID or password." }, { status: 401 });
    }

    const employee = await Employee.findOne({ orgId: user.orgId, empId: user.username })
      .select("designation isManager")
      .lean();
    const role = employee?.designation?.trim().toUpperCase() === "DIRECTOR"
      ? "DIRECTOR"
      : employee?.isManager && user.role === "USER" ? "MANAGER" : user.role;
    const identity = {
      id: user._id.toString(),
      name: user.employeeName || user.name || user.username,
      empId: user.username,
      role,
      orgId: user.orgId,
      isFirstLogin: Boolean(user.isFirstLogin),
    };

    return Response.json({ token: createMobileToken(identity), user: identity });
  } catch (error) {
    console.error("[MOBILE_AUTH] Login failed:", error);
    return Response.json({ message: "Unable to sign in right now." }, { status: 500 });
  }
}

