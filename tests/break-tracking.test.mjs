import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function fixture() {
  const attendance = { _id: "shift", totalBreakMinutes: 5 };
  const breaks = new Map();
  class AttendanceError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
  }
  const session = { withTransaction: async (fn) => fn(), endSession: async () => {} };
  const deps = {
    mongoose: { default: { startSession: async () => session } },
    "@/lib/mongoose": { connectDB: async () => {} },
    "@/models/Attendance": { default: { findByIdAndUpdate: async (id, update) => {
      assert.equal(id, "shift");
      // Match MongoDB update semantics: undefined does not remove stored fields.
      for (const [key, value] of Object.entries(update)) {
        if (!key.startsWith("$") && value !== undefined) attendance[key] = value;
      }
      for (const key of Object.keys(update.$unset || {})) delete attendance[key];
      for (const [key, value] of Object.entries(update.$inc || {})) attendance[key] = (attendance[key] || 0) + value;
    } } },
    "@/models/Break": { default: {
      create: async ([record]) => { const created = { ...record, _id: `break-${breaks.size}` }; breaks.set(created._id, created); return [created]; },
      findById: (id) => ({ session: async () => breaks.get(id) }),
      findByIdAndUpdate: async (id, update) => Object.assign(breaks.get(id), update),
    } },
    "../../_lib/attendance": {
      AttendanceError,
      requireAttendanceUser: async () => ({ orgId: "org", empId: "employee" }),
      getActiveAttendance: async (orgId, empId, dbSession) => {
        assert.equal(orgId, "org"); assert.equal(empId, "employee"); assert.equal(dbSession, session);
        return attendance;
      },
      errorResponse: (error) => Response.json({ message: error.message }, { status: error.status || 500 }),
    },
  };
  const handlers = {};
  for (const action of ["start", "end"]) {
    const source = readFileSync(new URL(`../app/api/attendance/break/${action}/route.js`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, { exports, require: (name) => { assert.ok(deps[name], name); return deps[name]; }, Response, Buffer, Date });
    handlers[action] = (body = {}) => exports.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }));
  }
  return { attendance, breaks, ...handlers };
}

test("actual break routes clear active state, accumulate duration and permit a subsequent break", async () => {
  const f = fixture();
  assert.equal((await f.start({ breakType: "LUNCH" })).status, 200);
  const active = f.breaks.get(f.attendance.currentBreakId);
  active.startTime = new Date(Date.now() - 10 * 60000);
  assert.equal((await f.start()).status, 409);
  assert.equal((await f.end()).status, 200);
  assert.equal(active.status, "COMPLETED");
  assert.equal(f.attendance.currentBreakId, undefined);
  assert.equal(f.attendance.breakStartedAt, undefined);
  assert.equal(f.attendance.totalBreakMinutes, 15);
  assert.equal((await f.end()).status, 409);
  assert.equal((await f.start()).status, 200);
});

test("break start rejects oversized and invalid bodies", async () => {
  const f = fixture();
  assert.equal((await f.start({ reason: "x".repeat(17000) })).status, 413);
  assert.equal((await f.start(null)).status, 400);
  assert.equal(f.breaks.size, 0);
});
