export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;
export const MINIMUM_PASSWORD_LENGTH = 12;

export function isLoginLocked(account, now = new Date()) {
  if (!account?.lockedUntil) return false;
  const lockedUntil = new Date(account.lockedUntil);
  return !Number.isNaN(lockedUntil.getTime()) && lockedUntil > now;
}

export function passwordPolicyError(password) {
  if (typeof password !== "string" || password.length < MINIMUM_PASSWORD_LENGTH) {
    return `Password must contain at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, and numeric characters.";
  }
  return null;
}
