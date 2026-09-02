import connectDB from "@/lib/mongoose";
import { createMobileToken } from "@/lib/mobileAuth";
import { CREDENTIAL_RESULT, credentialFields, verifyAccountPassword } from "@/lib/credentialAuth";
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
    const candidates = await User.find({ username: empId, ...(orgId ? { orgId } : {}) }).select(credentialFields).limit(2).lean();
    if (candidates.length !== 1) {
      return Response.json({ message: "Employee account is unavailable for this organization." }, { status: 401 });
    }
    const user = candidates[0];
    const credentialResult = await verifyAccountPassword(user, password);
    if (credentialResult !== CREDENTIAL_RESULT.VALID) {
      const message = credentialResult === CREDENTIAL_RESULT.LOCKED
        ? "Sign-in is temporarily locked after repeated failures. Try again in 15 minutes."
        : "Invalid employee ID or password.";
      return Response.json({ message }, { status: 401 });
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
      tokenVersion: Number(user.tokenVersion || 0),
    };

    return Response.json({ token: createMobileToken(identity), user: identity });
  } catch (error) {
    console.error("[MOBILE_AUTH] Login failed:", error);
    return Response.json({ message: "Unable to sign in right now." }, { status: 500 });
  }
}

