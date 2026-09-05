import assert from "node:assert/strict";
import test from "node:test";
import { cleanLocationTrack, trackLengthMeters } from "../lib/locationTrack.mjs";

const point = (latitude, longitude, seconds, extras = {}) => ({
  latitude,
  longitude,
  accuracy: 8,
  speed: 1.4,
  capturedAt: new Date(Date.UTC(2026, 8, 5, 8, 0, seconds)).toISOString(),
  ...extras,
});

test("location tracks discard low-accuracy fixes and stationary GPS drift", () => {
  const cleaned = cleanLocationTrack([
    point(17.4219, 78.3845, 0),
    point(17.4220, 78.38455, 10),
    point(17.4250, 78.3900, 20, { accuracy: 90 }),
    point(17.4222, 78.3847, 30),
  ]);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[1].latitude, 17.4222);
});

test("location tracks reject pen-like jumps inconsistent with device speed", () => {
  const cleaned = cleanLocationTrack([
    point(17.4219, 78.3845, 0, { speed: 0.2 }),
    point(17.4230, 78.3860, 30, { speed: 0.2 }),
    point(17.4222, 78.3848, 40, { speed: 1.2 }),
  ]);
  assert.equal(cleaned.length, 2);
  assert.ok(trackLengthMeters(cleaned) < 60);
});
