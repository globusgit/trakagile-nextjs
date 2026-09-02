import assert from "node:assert/strict";
import test from "node:test";

import { validateEnvironment } from "../lib/env.mjs";

test("environment validation rejects missing database and authentication secrets", () => {
  assert.throws(
    () => validateEnvironment({}),
    /MONGODB_URI, AUTH_SECRET or NEXTAUTH_SECRET/,
  );
});

test("environment validation accepts the legacy NextAuth secret name", () => {
  const environment = validateEnvironment({
    MONGODB_URI: "mongodb://localhost/trakagile",
    NEXTAUTH_SECRET: "test-secret",
    NODE_ENV: "test",
  });
  assert.equal(environment.authSecret, "test-secret");
  assert.equal(environment.platformAdminKey, null);
});

test("environment configuration is immutable and trims values", () => {
  const environment = validateEnvironment({
    MONGODB_URI: " mongodb://localhost/trakagile ",
    AUTH_SECRET: " secret ",
  });
  assert.equal(environment.mongoUri, "mongodb://localhost/trakagile");
  assert.equal(environment.authSecret, "secret");
  assert.equal(Object.isFrozen(environment), true);
});
