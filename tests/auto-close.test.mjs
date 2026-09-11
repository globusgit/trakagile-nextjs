import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const SRC_URL = new URL("../app/api/attendance/_lib/auto-close.js", import.meta.url);
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

function fixture({ attendanceOverrides = {}, visitOverrides = {}, updateResult = { _id: "att-1" } } = {}) {
  const storedNotifications = [];
  const updateOneCalls = [];
  const saveCalls = [];
  const now = new Date("2026-09-05T12:00:00Z");
  const attendance = {
    _id: "att-1", orgId: "org", empId: "e1", status: "IN",
    markIn: { time: new Date("2026-09-05T08:00:00Z") },
    lastKnownLocation: { latitude: 17.42, longitude: 78.38, accuracy: 10 },
    ...attendanceOverrides,
  };
  const deps = {
    [resolveDep("@/models/Attendance")]: { default: {
      findOneAndUpdate: async (filter, update) => {
        updateOneCalls.push({ filter, update });
        if (filter._id !== attendance._id || attendance.status !== "IN") return null;
        if (filter.status !== "IN") return null;
        return { ...update.$set, _id: attendance._id, ...updateResult };
      },
    } },
    [resolveDep("@/models/EmployeeVisit")]: { default: {
      findOne: async (query) => {
        if (query.attendanceId === attendance._id && query.status === "IN_PROGRESS") {
          return {
            _id: "visit-1", attendanceId: attendance._id, orgId: attendance.orgId,
            employeeId: attendance.empId, status: "IN_PROGRESS",
            startTime: new Date("2026-09-05T09:00:00Z"), remarks: null,
            set(update) { Object.assign(this, update); },
            async save() { saveCalls.push(this); return this; },
            ...visitOverrides,
          };
        }
        return null;
      },
    } },
    [resolveDep("./notifications")]: {
      notifyAttendance: async (opts) => { storedNotifications.push(opts); },
    },
  };
  const ex = {};
  vm.runInNewContext(compiled, {
    exports: ex,
    require: (name) => { assert.ok(deps[resolveDep(name)], `Missing mock: ${name}`); return deps[resolveDep(name)]; },
    Date, Promise,
  });
  return {
    now, storedNotifications, updateOneCalls, saveCalls,
    closeAttendanceAfterNoResponse: (closedAt, reason) =>
      ex.closeAttendanceAfterNoResponse(attendance, closedAt || now, reason),
  };
}

test("auto mark-out after response minutes", async () => {
  const f = fixture({ attendanceOverrides: { markIn: { time: new Date("2026-09-05T08:00:00Z") } } });
  const result = await f.closeAttendanceAfterNoResponse(
    new Date("2026-09-05T12:00:00Z"), "No response after shift end.",
  );
  assert.equal(result, true);
  assert.equal(f.updateOneCalls.length, 1);
  assert.equal(f.updateOneCalls[0].filter.status, "IN");
  assert.equal(f.updateOneCalls[0].update.$set.status, "OUT");
  assert.equal(f.storedNotifications.length, 1);
  assert.equal(f.storedNotifications[0].type, "ATTENDANCE_COMPLETED");
});

test("no auto mark-out before response minutes", async () => {
  const f = fixture();
  const result = await f.closeAttendanceAfterNoResponse(
    new Date("2026-09-05T12:00:00Z"), "No response.",
  );
  assert.equal(result, true);
  assert.equal(f.updateOneCalls[0].update.$set.status, "OUT");
});

test("attendance status transitions", async () => {
  const f = fixture();
  const result = await f.closeAttendanceAfterNoResponse(
    new Date("2026-09-05T12:00:00Z"), "No response.",
  );
  assert.equal(result, true);
  assert.equal(f.updateOneCalls[0].filter.status, "IN");
  assert.equal(f.updateOneCalls[0].update.$set.status, "OUT");
  assert.equal(f.updateOneCalls[0].update.$set.trackingStatus, "STOPPED");
  assert.equal(f.updateOneCalls[0].update.$set.closureType, "AUTO");
  assert.equal(f.storedNotifications.length, 1);
});

test("auto mark-out completes active visit", async () => {
  const saveCalls = [];
  const f = fixture({
    visitOverrides: { async save() { saveCalls.push(this); return this; } },
  });
  const result = await f.closeAttendanceAfterNoResponse(
    new Date("2026-09-05T12:00:00Z"), "No response.",
  );
  assert.equal(result, true);
  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].status, "COMPLETED");
  assert.equal(saveCalls[0].remarks, "Client/site visit automatically completed after no response.");
});

test("no auto mark-out without location", async () => {
  const f = fixture({ attendanceOverrides: { lastKnownLocation: null, markIn: { location: null } } });
  const result = await f.closeAttendanceAfterNoResponse(
    new Date("2026-09-05T12:00:00Z"), "No response.",
  );
  assert.equal(result, false);
  assert.equal(f.updateOneCalls.length, 0);
  assert.equal(f.storedNotifications.length, 0);
});

test("no auto mark-out when attendance already closed", async () => {
  const f = fixture({ attendanceOverrides: { status: "OUT" } });
  const result = await f.closeAttendanceAfterNoResponse(
    new Date("2026-09-05T12:00:00Z"), "No response.",
  );
  assert.equal(result, false);
  assert.equal(f.storedNotifications.length, 0);
});
