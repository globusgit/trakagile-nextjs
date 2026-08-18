import bcrypt from "bcryptjs";

import connectDB from "@/lib/mongoose";
import { createMobileToken } from "@/lib/mobileAuth";
import Employee from "@/models/Employee";
import User from "@/models/User";
import { organizationIdForCode } from "@/lib/organization";

export async function POST(request) {
  try {
    const body = await request.json();
    const empId = String(body.empId || "").trim();
    const password = String(body.password || "");
    const organizationCode = String(body.organizationCode || "").trim();
    if (!empId || !password) {
      return Response.json({ message: "Employee ID and password are required." }, { status: 400 });
    }

    await connectDB();
    const orgId = await organizationIdForCode(organizationCode);
    if (organizationCode && !orgId) {
      return Response.json({ message: "Invalid organization code." }, { status: 401 });
    }
    const candidates = await User.find({ username: empId, ...(orgId ? { orgId } : {}) }).limit(2).lean();
    if (candidates.length !== 1) {
      return Response.json({ message: "Employee account is unavailable for this organization." }, { status: 401 });
    }
    const user = candidates[0];
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

