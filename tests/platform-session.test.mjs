import test from "node:test";
import assert from "node:assert/strict";
import { createPlatformSession, verifyPlatformSession } from "../lib/platformSession.mjs";

const secret = "a-test-secret-that-is-not-used-in-production";

test("platform sessions preserve the authenticated administrator", () => {
  const now = Date.UTC(2026, 8, 5, 10);
  const token = createPlatformSession({ sub: "admin-id", username: "sysadmin" }, secret, now);
  const payload = verifyPlatformSession(token, secret, now + 60_000);
  assert.equal(payload.sub, "admin-id");
  assert.equal(payload.username, "sysadmin");
});

test("platform sessions reject tampering and expiration", () => {
  const now = Date.UTC(2026, 8, 5, 10);
  const token = createPlatformSession({ sub: "admin-id", username: "sysadmin" }, secret, now);
  assert.equal(verifyPlatformSession(`${token}x`, secret, now), null);
  assert.equal(verifyPlatformSession(token, secret, now + 9 * 60 * 60_000), null);
});
