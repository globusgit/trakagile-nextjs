import assert from "node:assert/strict";
import test from "node:test";
import { cleanLocationTrack, splitLocationTrack, trackLengthMeters } from "../lib/locationTrack.mjs";

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

test("location tracks never draw or count straight lines across GPS gaps", () => {
  const points = [
    point(17.4219, 78.3845, 0),
    point(17.4220, 78.3846, 30),
    { ...point(17.4250, 78.3850, 40), capturedAt: new Date(Date.UTC(2026, 8, 5, 8, 20, 0)).toISOString() },
    { ...point(17.4251, 78.3851, 50), capturedAt: new Date(Date.UTC(2026, 8, 5, 8, 20, 30)).toISOString() },
  ];
  const segments = splitLocationTrack(points);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].length, 2);
  assert.equal(segments[1].length, 2);
  assert.ok(trackLengthMeters(points) < 40);
});
