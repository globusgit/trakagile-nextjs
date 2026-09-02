import assert from "node:assert/strict";
import test from "node:test";

import {
  isLoginLocked,
  LOGIN_LOCK_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
  MINIMUM_PASSWORD_LENGTH,
  passwordPolicyError,
} from "../lib/loginPolicy.mjs";

test("login policy exposes the reviewed lockout thresholds", () => {
  assert.equal(MAX_FAILED_LOGIN_ATTEMPTS, 5);
  assert.equal(LOGIN_LOCK_MINUTES, 15);
});

test("an account is locked only while its lock timestamp is in the future", () => {
  const now = new Date("2026-09-02T10:00:00.000Z");
  assert.equal(isLoginLocked({ lockedUntil: "2026-09-02T10:01:00.000Z" }, now), true);
  assert.equal(isLoginLocked({ lockedUntil: "2026-09-02T09:59:59.000Z" }, now), false);
  assert.equal(isLoginLocked({}, now), false);
});

test("password policy requires length and mixed character classes", () => {
  assert.equal(MINIMUM_PASSWORD_LENGTH, 12);
  assert.match(passwordPolicyError("Short1A") || "", /at least 12/);
  assert.match(passwordPolicyError("alllowercase123") || "", /uppercase/);
  assert.match(passwordPolicyError("ALLUPPERCASE123") || "", /lowercase/);
  assert.match(passwordPolicyError("NoNumbersHere") || "", /numeric/);
  assert.equal(passwordPolicyError("International9Secure"), null);
});
