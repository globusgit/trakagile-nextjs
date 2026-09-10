import assert from "node:assert/strict";
import test from "node:test";
import { createAttendanceTracker } from "../lib/browserAttendanceTracking.mjs";

function fixture(overrides = {}) {
  const sent = [], updates = [], errors = [];
  let status = "IN";
  let timestamp = Date.UTC(2026, 8, 10, 7);
  const tracker = createAttendanceTracker({
    getAttendance: async () => ({ _id: "shift", status }),
    getPosition: async () => ({ timestamp: timestamp += 60_000, coords: { latitude: 17.42, longitude: 78.38, accuracy: 72, speed: 0, heading: null } }),
    sendLocation: async (point) => { sent.push(point); return { accepted: true }; },
    onUpdate: (result) => updates.push(result),
    onError: (error) => errors.push(error),
    ...overrides,
  });
  return { tracker, sent, updates, errors, setStatus: (value) => { status = value; } };
}

test("each scheduled capture sends a distinct stationary minute point, including 72m GPS accuracy", async () => {
  const f = fixture();
  await f.tracker.tick();
  await f.tracker.tick();
  await f.tracker.tick();
  assert.equal(f.sent.length, 3);
  assert.equal(new Set(f.sent.map((p) => p.clientPointId)).size, 3);
  assert.ok(f.sent.every((p) => p.minuteTrigger && p.accuracy === 72 && p.speed === 0));
  assert.equal(f.updates.length, 3);
});

test("mark in starts capture and mark out stops subsequent capture", async () => {
  const f = fixture();
  f.setStatus("OUT");
  await f.tracker.tick();
  assert.equal(f.sent.length, 0);
  f.setStatus("IN");
  await f.tracker.tick();
  f.setStatus("OUT");
  await f.tracker.tick();
  assert.equal(f.sent.length, 1);
});

test("WFH does not request GPS", async () => {
  const f = fixture({ getAttendance: async () => ({ status: "IN", attendanceType: "WORK_FROM_HOME" }), getPosition: () => { assert.fail("WFH GPS requested"); } });
  await f.tracker.tick();
  assert.equal(f.sent.length, 0);
  assert.equal(f.errors.length, 0);
});

test("rejected GPS never reports an active successful sync and next minute recovers", async () => {
  let calls = 0;
  const f = fixture({ sendLocation: async () => ++calls === 1 ? { accepted: false, reason: "LOW_ACCURACY" } : { accepted: true } });
  await f.tracker.tick();
  assert.equal(f.errors.length, 1);
  assert.equal(f.updates.length, 0);
  await f.tracker.tick();
  assert.equal(f.updates.length, 1);
});

test("a disconnected request recovers on the next tick", async () => {
  let calls = 0;
  const f = fixture({ getAttendance: async () => { if (++calls === 1) throw new Error("offline"); return { status: "IN", _id: "shift" }; } });
  await f.tracker.tick();
  await f.tracker.tick();
  assert.equal(f.errors.length, 1);
  assert.equal(f.sent.length, 1);
});

test("overlapping timer/resume ticks do not duplicate requests; unmount cancels pending GPS upload", async () => {
  let release;
  const f = fixture({ getPosition: () => new Promise((resolve) => { release = resolve; }) });
  const pending = f.tracker.tick();
  await Promise.resolve();
  await f.tracker.tick();
  f.tracker.stop();
  release({ timestamp: Date.now(), coords: { latitude: 17.42, longitude: 78.38 } });
  await pending;
  await f.tracker.tick();
  assert.equal(f.sent.length, 0);
  assert.equal(f.errors.length, 0);
});
