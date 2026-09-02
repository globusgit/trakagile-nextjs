import assert from "node:assert/strict";
import test from "node:test";

import {
  hasPermission,
  permissionMatrix,
  PERMISSIONS,
  rolesForPermission,
} from "../lib/permissions.mjs";

test("organization-wide visibility is limited to HR and organization administrators", () => {
  assert.deepEqual(rolesForPermission(PERMISSIONS.ORGANIZATION_READ_ALL), ["HR", "ADMIN", "DIRECTOR"]);
  assert.equal(hasPermission("manager", PERMISSIONS.ORGANIZATION_READ_ALL), false);
});

test("managers can manage tasks and review leave without organization-wide task access", () => {
  assert.equal(hasPermission("MANAGER", PERMISSIONS.TASK_MANAGE), true);
  assert.equal(hasPermission("MANAGER", PERMISSIONS.LEAVE_REVIEW), true);
  assert.equal(hasPermission("MANAGER", PERMISSIONS.TASK_READ_ALL), false);
});

test("ordinary and unknown roles receive no elevated permissions", () => {
  for (const role of ["USER", "ACCOUNTANT", "", "SUPERUSER", undefined]) {
    assert.equal(hasPermission(role, PERMISSIONS.AUDIT_READ), false);
    assert.equal(hasPermission(role, PERMISSIONS.DOCUMENT_DELETE_ANY), false);
  }
});

test("permission matrix returns a defensive copy", () => {
  const first = permissionMatrix();
  first.ADMIN.length = 0;
  assert.equal(hasPermission("ADMIN", PERMISSIONS.AUDIT_READ), true);
});

test("specialized workforce permissions preserve current role boundaries", () => {
  assert.deepEqual(rolesForPermission(PERMISSIONS.ATTENDANCE_LIVE_READ), ["MANAGER", "ADMIN", "DIRECTOR"]);
  assert.deepEqual(rolesForPermission(PERMISSIONS.ATTENDANCE_GROUP_READ), ["MANAGER", "HR", "ADMIN", "DIRECTOR"]);
  assert.deepEqual(rolesForPermission(PERMISSIONS.ATTENDANCE_GROUP_CREATE), ["MANAGER", "ADMIN", "DIRECTOR"]);
  assert.deepEqual(rolesForPermission(PERMISSIONS.HOLIDAY_MANAGE), ["MANAGER", "ADMIN", "DIRECTOR"]);
  assert.deepEqual(rolesForPermission(PERMISSIONS.USER_MANAGE), ["ADMIN", "DIRECTOR"]);
});
