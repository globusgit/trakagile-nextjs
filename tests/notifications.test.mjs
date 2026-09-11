import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const SRC_URL = new URL("../app/api/attendance/_lib/notifications.js", import.meta.url);
const BASE_URL = new URL(".", SRC_URL);

function resolveDep(name) {
  if (name.startsWith("@/")) return name;
  if (name.startsWith("./") || name.startsWith("../")) {
    return new URL(name, BASE_URL).toString();
  }
  return name;
}

const compiled = ts.transpileModule(
  readFileSync(SRC_URL, "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function fixture({ employees = [], manager = null, existingNotifications = [] } = {}) {
  const storedNotifications = [];
  const findOneCalls = [];
  const deps = {
    [resolveDep("@/models/Employee")]: { default: {
      findOne: (query) => {
        findOneCalls.push(query);
        const match = (emp) => {
          if (query._id && String(emp._id) !== String(query._id)) return false;
          if (query.empId && emp.empId !== query.empId) return false;
          if (query.orgId && emp.orgId !== query.orgId) return false;
          if (query.status && emp.status !== query.status) return false;
          return true;
        };
        const matched = query._id
          ? (manager && match(manager) ? manager : null)
          : employees.find((emp) => match(emp)) || null;
        const result = matched ? { ...matched } : null;
        return {
          select(fields) {
            if (!result) return { lean: async () => null };
            const pick = (keys) => {
              const out = {};
              for (const key of keys.split(" ")) {
                if (key && result[key] !== undefined) out[key] = result[key];
              }
              return out;
            };
            return { lean: async () => pick(fields) };
          },
        };
      },
    } },
    [resolveDep("@/models/Notification")]: { default: {
      updateOne: async (filter, update, opts) => {
        const exists = existingNotifications.find(
          (n) => n.dedupeKey === filter.dedupeKey && n.recipientEmpId === filter.recipientEmpId,
        );
        if (exists) return;
        storedNotifications.push({ filter, update, upsert: opts?.upsert });
      },
    } },
    [resolveDep("@/lib/trackingPolicy.mjs")]: {},
    [resolveDep("@/lib/logger.mjs")]: { createLogger: () => ({ error: () => {} }) },
  };
  const ex = {};
  vm.runInNewContext(compiled, {
    exports: ex,
    require: (name) => { assert.ok(deps[resolveDep(name)], `Missing mock: ${name}`); return deps[resolveDep(name)]; },
    Date,
  });
  return {
    findOneCalls,
    storedNotifications,
    attendanceRecipients: (orgId, empId) => ex.attendanceRecipients(orgId, empId),
    notifyAttendance: (opts) => ex.notifyAttendance(opts),
  };
}

function makeEmployee(empId, overrides = {}) {
  return {
    _id: overrides._id ?? empId,
    empId, orgId: overrides.orgId ?? "org",
    status: overrides.status ?? "Active", reportingTo: overrides.reportingTo ?? null,
    ...overrides,
  };
}

test("attendanceRecipients includes employee and manager", async () => {
  const manager = makeEmployee("mgr-1");
  const f = fixture({ employees: [makeEmployee("e1", { reportingTo: "mgr-1" })], manager });
  const recipients = await f.attendanceRecipients("org", "e1");
  assert.ok(JSON.stringify([...recipients].sort()) === JSON.stringify(["e1", "mgr-1"]));
});

test("attendanceRecipients returns only employee when no manager", async () => {
  const f = fixture({ employees: [makeEmployee("e1")] });
  const recipients = await f.attendanceRecipients("org", "e1");
  assert.ok(JSON.stringify([...recipients]) === JSON.stringify(["e1"]));
});

test("attendanceRecipients excludes inactive manager", async () => {
  const f = fixture({
    employees: [makeEmployee("e1", { reportingTo: "mgr-1" })],
    manager: makeEmployee("mgr-1", { status: "Inactive" }),
  });
  const recipients = await f.attendanceRecipients("org", "e1");
  assert.ok(JSON.stringify([...recipients]) === JSON.stringify(["e1"]));
});

test("notifyAttendance deduplication", async () => {
  const f = fixture({
    employees: [makeEmployee("e1")],
    existingNotifications: [{ dedupeKey: "key-1", recipientEmpId: "e1" }],
  });
  await f.notifyAttendance({
    orgId: "org", empId: "e1", attendanceId: "att-1",
    type: "ATTENDANCE_COMPLETED", title: "Done", message: "msg", dedupeKey: "key-1",
  });
  assert.equal(f.storedNotifications.length, 0);
});

test("notifyAttendance inserts new notification", async () => {
  const f = fixture({ employees: [makeEmployee("e1")] });
  await f.notifyAttendance({
    orgId: "org", empId: "e1", attendanceId: "att-1",
    type: "ATTENDANCE_COMPLETED", title: "Done", message: "msg", dedupeKey: "key-new",
  });
  assert.equal(f.storedNotifications.length, 1);
  assert.equal(f.storedNotifications[0].filter.dedupeKey, "key-new");
  assert.equal(f.storedNotifications[0].filter.recipientEmpId, "e1");
});

test("notifyAttendance sends to both employee and manager", async () => {
  const manager = makeEmployee("mgr-1");
  const f = fixture({ employees: [makeEmployee("e1", { reportingTo: "mgr-1" })], manager });
  await f.notifyAttendance({
    orgId: "org", empId: "e1", attendanceId: "att-1",
    type: "ATTENDANCE_COMPLETED", title: "Done", message: "msg", dedupeKey: "key-both",
  });
  assert.equal(f.storedNotifications.length, 2);
  assert.ok(JSON.stringify(f.storedNotifications.map((n) => n.filter.recipientEmpId).sort()) === JSON.stringify(["e1", "mgr-1"]));
});
