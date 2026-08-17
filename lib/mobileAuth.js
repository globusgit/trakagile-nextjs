import crypto from "node:crypto";

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function secret() {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be configured.");
  return value;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createMobileToken(identity) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ ...identity, iat: now, exp: now + TOKEN_TTL_SECONDS });
  return `${payload}.${signature(payload)}`;
}

export function verifyMobileToken(token) {
  const [payload, suppliedSignature] = String(token || "").split(".");
  if (!payload || !suppliedSignature) return null;

  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;

  try {
    const identity = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!identity.exp || identity.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!identity.empId || !identity.orgId || !identity.id) return null;
    return identity;
  } catch {
    return null;
  }
}

