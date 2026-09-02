import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/mongoose";
import { CREDENTIAL_RESULT, credentialFields, verifyAccountPassword } from "@/lib/credentialAuth";
import { passwordPolicyError } from "@/lib/loginPolicy.mjs";
import User from "@/models/User";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

export async function PUT(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(undefined, { allowFirstLogin: true });
    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new AttendanceError("Current, new, and confirmation passwords are required.");
    }
    if (newPassword !== confirmPassword) {
      throw new AttendanceError("New password and confirmation do not match.");
    }
    const policyError = passwordPolicyError(newPassword);
    if (policyError) throw new AttendanceError(policyError);

    const account = await User.findOne({
      _id: identity.userId,
      username: identity.empId,
      orgId: identity.orgId,
      status: "Active",
    }).select(credentialFields);
    if (!account) throw new AttendanceError("Account is unavailable.", 401);

    const credentialResult = await verifyAccountPassword(account, currentPassword);
    if (credentialResult !== CREDENTIAL_RESULT.VALID) {
      throw new AttendanceError(
        credentialResult === CREDENTIAL_RESULT.LOCKED
          ? "Password verification is temporarily locked. Try again in 15 minutes."
          : "Current password is incorrect.",
        401,
      );
    }
    if (await bcrypt.compare(newPassword, account.password)) {
      throw new AttendanceError("New password must be different from the current password.");
    }

    await User.updateOne(
      { _id: account._id, orgId: identity.orgId },
      {
        $set: {
          password: await bcrypt.hash(newPassword, 12),
          isFirstLogin: false,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
        },
        $unset: { lockedUntil: 1 },
        $inc: { tokenVersion: 1 },
      },
    );

    return Response.json({ message: "Password changed. Sign in again with your new password." });
  } catch (error) {
    return errorResponse(error, "Unable to change password.");
  }
}
