import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(new URL("../app/api/attendance/location/route.js", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function fixture({ existingMinute = false, duplicate = false, previousSeconds = 60 } = {}) {
  const capturedAt = new Date();
  const attendance = {
    _id: "shift", status: "IN", totalDistanceMeters: 0,
    markIn: { time: new Date(capturedAt.getTime() - 3_600_000) },
    lastKnownLocation: { latitude: 17.42, longitude: 78.38, accuracy: 72, capturedAt: new Date(capturedAt.getTime() - previousSeconds * 1000) },
  };
  const stored = [], updates = [];
  const dbSession = { withTransaction: async (fn) => fn(), endSession: async () => {} };
  const bodyData = {
    latitude: 17.42, longitude: 78.38, accuracy: 10, speed: 0,
    capturedAt: capturedAt.toISOString(), clientPointId: "point",
  };
  const dependencies = {
    "mongoose": { default: { startSession: async () => dbSession } },
    "@/lib/mongoose": { connectDB: async () => {} },
    "@/models/Attendance": { default: {
      updateOne: async (...args) => { updates.push(args); },
      findOneAndUpdate: async (...args) => { updates.push(args); return attendance; },
    } },
    "@/models/EmployeeVisit": { default: { findOne: () => ({ session: () => null }) } },
    "@/models/TrackingLocation": { default: {
      exists: async (query) => query.clientPointId ? duplicate : existingMinute,
      findOne: () => ({ sort: () => ({ select: () => ({ lean: async () => null }) }) }),
      aggregate: async (pipeline) => {
        const matchStage = pipeline.find((s) => s.$match);
        if (matchStage?.$match?.attendanceId === "shift") {
          return [{ _id: "shift", points: [{
            _id: "hist-1", attendanceId: "shift", orgId: "org", employeeId: "employee",
            latitude: 17.42, longitude: 78.38, accuracy: 72,
            capturedAt: new Date(capturedAt.getTime() - previousSeconds * 1000),
            receivedAt: new Date(capturedAt.getTime() - previousSeconds * 1000),
            locationName: null, speed: 0, locationTrigger: false,
          }] }];
        }
        return [];
      },
      create: async (points) => { stored.push(...points); },
    } },
    "../_lib/attendance": {
      AttendanceError: Error,
      requireAttendanceUser: async () => ({ empId: "employee", orgId: "org" }),
      getActiveAttendance: async () => attendance,
      locationFrom: (body, now) => ({ ...body, capturedAt: new Date(body.capturedAt), receivedAt: now }),
      movementFrom: (body) => ({ speed: body.speed ?? null }),
      reliableDistance: () => 0,
      distanceBetween: () => 0,
      getAttendancePolicy: async () => ({}),
      attendanceExpectedEndAt: () => new Date(Date.now() + 3_600_000),
      errorResponse: (error) => Response.json({ message: error.message }, { status: error.status || 500 }),
    },
    "../_lib/notifications": { notifyAttendance: async () => {}, reverseGeocode: async () => null },
    "../_lib/auto-close": { closeAttendanceAfterNoResponse: async () => false },
    "@/lib/trackingPolicy.mjs": { TRACKING_INTERVAL_MS: 5 * 60_000, MAX_ACCURACY_MINUTE_TRIGGER: 100, MAX_ACCURACY_STREAM: 60, UNREALISTIC_SPEED_MPS: 45, TRAVEL_START_DISTANCE: 100, LOCATION_NAME_REFRESH_DISTANCE: 250, REVERSE_GEOCODE_TTL_MS: 24 * 60 * 60 * 1000, REVERSE_GEOCODE_CACHE_PRECISION: 4 },
    "@/lib/logger.mjs": { createLogger: () => ({ error: () => {}, warn: () => {} }) },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => {
    assert.ok(dependencies[name], `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, Response, Date, Buffer });
  return {
    stored, updates,
    post: async (overrides = {}) => {
      const merged = { ...bodyData, ...overrides };
      const mergedText = JSON.stringify(merged);
      const response = await exports.POST({
        json: async () => merged,
        text: async () => mergedText,
        headers: { get: (k) => k === "content-length" ? String(Buffer.byteLength(mergedText)) : undefined },
      });
      return response.json();
    },
  };
}

test("upload persists the screenshot's stationary 72m minute fix without adding distance", async () => {
  const f = fixture();
  const result = await f.post({ minuteTrigger: true });
  assert.equal(result.accepted, true);
  assert.equal(f.stored.length, 1);
  assert.equal(f.stored[0].minuteTrigger, true);
  assert.equal(result.distanceAddedMeters, 0);
  assert.equal(f.updates.length, 1);
});

test("older clients' stationary fixes become minute triggers without requiring the flag", async () => {
  const f = fixture();
  const result = await f.post();
  assert.equal(result.accepted, true);
  assert.equal(f.stored[0].minuteTrigger, true);
});

test("extra stationary stream fixes within a recorded five-minute window remain heartbeats", async () => {
  const f = fixture({ existingMinute: true });
  const result = await f.post({ accuracy: 8 });
  assert.equal(result.reason, "INTERVAL_NOT_DUE");
  assert.equal(f.stored.length, 0);
  assert.equal(f.updates.length, 0);
});

test("unusable accuracy is rejected without advancing the live heartbeat", async () => {
  const f = fixture();
  const result = await f.post({ accuracy: 150, minuteTrigger: true });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "LOW_ACCURACY");
  assert.equal(f.stored.length, 0);
  assert.equal(f.updates.length, 0);
});

test("retrying an acknowledged point does not duplicate stored history", async () => {
  const f = fixture({ duplicate: true });
  const result = await f.post();
  assert.equal(result.duplicate, true);
  assert.equal(f.stored.length, 0);
});

test("queued older minute fixes are stored without replacing the newer live position", async () => {
  const f = fixture({ previousSeconds: -60 });
  const result = await f.post({ minuteTrigger: true });
  assert.equal(result.historical, true);
  assert.equal(f.stored.length, 1);
  assert.equal(f.updates.length, 0);
});
