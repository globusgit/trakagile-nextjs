import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const SRC_URL = new URL("../app/api/attendance/live/route.js", import.meta.url);
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

function fixture({ employees = [], attendances = [], tracks = new Map() } = {}) {
  const storedNotifications = [];
  const deps = {
    [resolveDep("@/lib/mongoose")]: { connectDB: async () => {} },
    [resolveDep("@/models/Attendance")]: { default: {
      find: (query) => ({
        sort: () => ({
          limit: (lim) => ({
            lean: async () => attendances.filter((a) => {
              if (query.orgId && a.orgId !== query.orgId) return false;
              if (query.empId && query.empId.$in && !query.empId.$in.includes(a.empId)) return false;
              if (query._id && a._id <= query._id) return false;
              return true;
            }).slice(0, lim),
          }),
        }),
      }),
    } },
    [resolveDep("@/models/Employee")]: { default: {
      find: () => ({
        select: () => ({
          lean: async () => employees.map((e) => ({
            name: e.name, empId: e.empId, photo: e.photo, reportingTo: e.reportingTo ?? null,
          })),
        }),
      }),
    } },
    [resolveDep("@/lib/access")]: { visibleEmployeeIds: async () => null },
    [resolveDep("../_lib/attendance")]: {
      AttendanceError: Error,
      requireAttendanceUser: async () => ({ empId: "manager", orgId: "org", role: "MANAGER" }),
      errorResponse: (error) => { throw error; },
    },
    [resolveDep("@/lib/permissions.mjs")]: {
      PERMISSIONS: { ATTENDANCE_LIVE_READ: "ATTENDANCE_LIVE_READ" },
      rolesForPermission: () => ["MANAGER", "ADMIN", "DIRECTOR"],
    },
    [resolveDep("@/lib/attendanceTracks")]: {
      attendanceTracks: async () => tracks,
    },
    [resolveDep("@/models/Break")]: { default: { find: () => ({ select: () => ({ lean: async () => [] }) }) } },
    [resolveDep("@/lib/trackingPolicy.mjs")]: { TRACKING_STALE_MS: 6 * 60_000 },
    [resolveDep("../_lib/notifications")]: {
      notifyAttendance: async (opts) => { storedNotifications.push(opts); },
    },
    [resolveDep("../_lib/work-status")]: {
      workStatusFor: (attendance) => ({
        state: attendance.status === "IN" ? "VERIFIED" : "STOPPED",
        label: attendance.status === "IN" ? "Online" : "Not working",
      }),
    },
  };
  const ex = {};
  vm.runInNewContext(compiled, {
    exports: ex,
    require: (name) => { assert.ok(deps[resolveDep(name)], `Missing mock: ${name}`); return deps[resolveDep(name)]; },
    Response, Map, Promise, Date, URL,
  });
  return {
    storedNotifications,
    get: async () => {
      const response = await ex.GET({ url: "http://localhost/api/attendance/live" });
      const json = await response.json();
      return { status: response.status, ...json };
    },
  };
}

function makeEmployee(id, overrides = {}) {
  return { name: `Employee ${id}`, empId: id, photo: null, reportingTo: overrides.reportingTo ?? null, ...overrides };
}

function makeAttendance(id, overrides = {}) {
  return {
    _id: `att-${id}`, orgId: "org", empId: id, status: "IN",
    lastKnownLocation: overrides.lastKnownLocation ?? null,
    lastLocationReceivedAt: overrides.lastLocationReceivedAt ?? null,
    expectedWorkEndAt: overrides.expectedWorkEndAt ?? null,
    overtime: overrides.overtime ?? null,
    markIn: overrides.markIn ?? { time: new Date("2026-09-05T08:00:00Z") },
    ...overrides,
  };
}

test("GET returns employees array", async () => {
  const f = fixture({ employees: [makeEmployee("e1"), makeEmployee("e2")], attendances: [makeAttendance("e1")] });
  const result = await f.get();
  assert.equal(result.status, 200);
  assert.equal(Array.isArray(result.employees), true);
  assert.equal(result.employees.length, 1);
  assert.equal(result.employees[0].employee.empId, "e1");
});

test("empty employees returns empty array", async () => {
  const f = fixture({ employees: [], attendances: [] });
  const result = await f.get();
  assert.equal(result.status, 200);
  assert.deepEqual(result.employees, []);
});

test("track data is included in response", async () => {
  const tracks = new Map([
    ["att-e1", {
      location: { latitude: 17.42, longitude: 78.38, accuracy: 10, receivedAt: new Date() },
      triggerPoints: [],
      movementPoints: [{ latitude: 17.42, longitude: 78.38 }],
      filteredDistanceMeters: 120,
    }],
  ]);
  const f = fixture({ employees: [makeEmployee("e1")], attendances: [makeAttendance("e1")], tracks });
  const result = await f.get();
  const entry = result.employees[0];
  assert.equal(entry.movementPoints.length, 1);
  assert.equal(entry.filteredDistanceMeters, 120);
  assert.ok(entry.location);
});

test("workStatus is computed correctly", async () => {
  const f = fixture({ employees: [makeEmployee("e1")], attendances: [makeAttendance("e1")] });
  const result = await f.get();
  assert.equal(result.employees[0].workStatus.state, "VERIFIED");
  assert.equal(result.employees[0].workStatus.label, "Online");
});

test("stale employees receive notification", async () => {
  const f = fixture({
    employees: [makeEmployee("e1")],
    attendances: [makeAttendance("e1", { lastLocationReceivedAt: new Date(Date.now() - 10 * 60_000).toISOString() })],
  });
  await f.get();
  assert.equal(f.storedNotifications.length, 1);
  assert.equal(f.storedNotifications[0].type, "LOCATION_STALE");
});
