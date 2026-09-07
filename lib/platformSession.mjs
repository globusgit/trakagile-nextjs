import { createHmac, timingSafeEqual } from "node:crypto";

export const PLATFORM_SESSION_COOKIE = "trakagile_platform_session";
export const PLATFORM_SESSION_SECONDS = 8 * 60 * 60;

function signature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createPlatformSession(payload, secret, now = Date.now()) {
  const encoded = Buffer.from(JSON.stringify({
    sub: String(payload.sub),
    username: String(payload.username),
    exp: Math.floor(now / 1000) + PLATFORM_SESSION_SECONDS,
  })).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyPlatformSession(token, secret, now = Date.now()) {
  if (typeof token !== "string" || !secret) return null;
  const [encoded, supplied, extra] = token.split(".");
  if (!encoded || !supplied || extra) return null;
  const expected = signature(encoded, secret);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.sub || !payload.username || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(now / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
