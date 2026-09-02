import assert from "node:assert/strict";
import test from "node:test";

import {
  belongsToTenant,
  tenantFilter,
  tenantId,
  TenantScopeError,
} from "../lib/tenantScope.mjs";

test("tenant filters always use the authenticated organization", () => {
  const identity = { orgId: "ORG-A" };
  assert.deepEqual(tenantFilter(identity, { status: "Active" }), {
    status: "Active",
    orgId: "ORG-A",
  });
  assert.deepEqual(tenantFilter(identity, { orgId: "ORG-B", status: "Active" }), {
    orgId: "ORG-A",
    status: "Active",
  });
});

test("tenant access fails closed when authentication has no organization", () => {
  for (const identity of [null, {}, { orgId: "" }]) {
    assert.throws(() => tenantId(identity), TenantScopeError);
    assert.throws(() => tenantFilter(identity, { status: "Active" }), TenantScopeError);
  }
});

test("cross-organization resources never satisfy tenant ownership", () => {
  assert.equal(belongsToTenant({ orgId: "ORG-A" }, { orgId: "ORG-A" }), true);
  assert.equal(belongsToTenant({ orgId: "ORG-A" }, { orgId: "ORG-B" }), false);
  assert.equal(belongsToTenant({ orgId: "ORG-A" }, {}), false);
});
