import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual shared GPS validators, without authentication or database I/O.
const source = readFileSync(new URL("../app/api/attendance/_lib/attendance.js", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require: () => ({}), Date, Response, console, Error });
const { locationFrom, movementFrom, AttendanceError } = exports;
const now = new Date("2026-09-11T10:30:00Z");

test("valid mobile and web GPS coordinates pass shared attendance validation", () => {
  const location = locationFrom({ latitude: 17.452, longitude: 78.3936, accuracy: 12, capturedAt: now.toISOString() }, now);
  assert.equal(location.latitude, 17.452);
  assert.equal(location.longitude, 78.3936);
  assert.equal(location.accuracy, 12);
  assert.equal(location.receivedAt, now);
  assert.equal(locationFrom({ latitude: 0, longitude: 0 }, now).accuracy, undefined);
});

test("non-finite and out-of-range GPS values produce validation errors", () => {
  for (const [field, values] of Object.entries({ latitude: [NaN, Infinity, -Infinity, 91, -91], longitude: [NaN, Infinity, -Infinity, 181, -181], accuracy: [NaN, Infinity, -Infinity, -1] })) {
    for (const value of values) assert.throws(() => locationFrom({ latitude: 17, longitude: 78, [field]: value }, now), AttendanceError);
  }
});

test("movement validation accepts finite readings and rejects invalid readings", () => {
  const movement = movementFrom({ speed: 0, heading: 360 });
  assert.equal(movement.speed, 0);
  assert.equal(movement.heading, 360);
  assert.equal(movementFrom({}).speed, null);
  for (const field of ["speed", "heading"]) {
    for (const value of [NaN, Infinity, -Infinity, -1]) assert.throws(() => movementFrom({ [field]: value }), AttendanceError);
  }
  assert.throws(() => movementFrom({ heading: 361 }), AttendanceError);
});
