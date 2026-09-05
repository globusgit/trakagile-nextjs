import test from "node:test";
import assert from "node:assert/strict";
import { workStatusFor } from "../app/api/attendance/_lib/work-status.js";

test("a fresh stationary heartbeat keeps an employee online", () => {
  const now = new Date("2026-09-05T11:27:00.000Z");
  const attendance = {
    status: "IN",
    attendanceType: "OFFICE",
    lastLocationReceivedAt: new Date("2026-09-05T11:26:00.000Z"),
  };
  const lastMovement = {
    latitude: 17.421,
    longitude: 78.384,
    accuracy: 14,
    receivedAt: new Date("2026-09-05T10:01:00.000Z"),
  };
  assert.equal(workStatusFor(attendance, lastMovement, now).state, "VERIFIED");
});

test("an old heartbeat still reports GPS as overdue", () => {
  const now = new Date("2026-09-05T11:27:00.000Z");
  const attendance = {
    status: "IN",
    attendanceType: "OFFICE",
    lastLocationReceivedAt: new Date("2026-09-05T11:20:00.000Z"),
  };
  const point = { latitude: 17.421, longitude: 78.384, accuracy: 14 };
  assert.equal(workStatusFor(attendance, point, now).state, "NEEDS_ATTENTION");
});
