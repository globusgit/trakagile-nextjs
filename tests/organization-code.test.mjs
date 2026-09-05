import test from "node:test";
import assert from "node:assert/strict";
import { availableOrganizationCode, organizationCodeBase } from "../lib/organizationCode.mjs";

test("organization codes are generated from organization names", () => {
  assert.equal(organizationCodeBase("Frazen Technologies Pvt Ltd"), "FTPL");
  assert.equal(organizationCodeBase("Acme"), "ACME");
});

test("organization code generation adds a unique suffix", async () => {
  const existing = new Set(["FTPL", "FTPL-2"]);
  assert.equal(await availableOrganizationCode("Frazen Technologies Pvt Ltd", async (code) => existing.has(code)), "FTPL-3");
});
