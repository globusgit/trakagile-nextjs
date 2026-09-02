import bcrypt from "bcryptjs";

import User from "@/models/User";
import {
  isLoginLocked,
  LOGIN_LOCK_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "@/lib/loginPolicy.mjs";

export const CREDENTIAL_RESULT = Object.freeze({
  VALID: "VALID",
  INVALID: "INVALID",
  LOCKED: "LOCKED",
});

export const credentialFields = "+password +failedLoginAttempts +lockedUntil +tokenVersion";

export async function verifyAccountPassword(account, password, now = new Date()) {
  if (!account || account.status !== "Active" || !account.password) {
    return CREDENTIAL_RESULT.INVALID;
  }
  if (isLoginLocked(account, now)) return CREDENTIAL_RESULT.LOCKED;

  if (!(await bcrypt.compare(password, account.password))) {
    const updated = await User.findByIdAndUpdate(
      account._id,
      { $inc: { failedLoginAttempts: 1 } },
      { new: true },
    ).select("+failedLoginAttempts +lockedUntil");
    if (Number(updated?.failedLoginAttempts || 0) >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await User.updateOne(
        { _id: account._id },
        { $set: { lockedUntil: new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60_000) } },
      );
      return CREDENTIAL_RESULT.LOCKED;
    }
    return CREDENTIAL_RESULT.INVALID;
  }

  if (account.failedLoginAttempts || account.lockedUntil) {
    await User.updateOne(
      { _id: account._id },
      { $set: { failedLoginAttempts: 0 }, $unset: { lockedUntil: 1 } },
    );
  }
  return CREDENTIAL_RESULT.VALID;
}
