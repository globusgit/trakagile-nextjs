import assert from "node:assert/strict";
import test from "node:test";
import { cleanLocationTrack, latestLocation, locationTriggerPoints, splitLocationTrack, trackLengthMeters } from "../lib/locationTrack.mjs";

const point = (latitude, longitude, seconds, extras = {}) => ({
  latitude,
  longitude,
  accuracy: 8,
  speed: 1.4,
  capturedAt: new Date(Date.UTC(2026, 8, 5, 8, 0, seconds)).toISOString(),
  ...extras,
});

test("queued historical uploads never replace the newest captured live fix", () => {
  const live = point(17.4219, 78.3845, 50, { accuracy: 75 });
  const queued = point(17.4200, 78.3800, 10, { receivedAt: '2026-09-05T09:00:00Z' });
  assert.equal(latestLocation(queued, live), live);
  assert.equal(latestLocation(null, live, queued), live);
});

test("stationary and lower-accuracy minute triggers survive movement filtering in chronological order", () => {
  const start = point(17.4219, 78.3845, 0);
  const first = point(17.4219, 78.3845, 20, { minuteTrigger: true });
  const second = point(17.4219, 78.3845, 40, { minuteTrigger: true, accuracy: 75 });
  assert.equal(cleanLocationTrack([start, first, second]).length, 1);
  const triggers = locationTriggerPoints([second, first], start);
  assert.deepEqual(triggers.map((p) => p.capturedAt), [start, first, second].map((p) => p.capturedAt));
  assert.deepEqual(triggers.map((p) => p.type), ['MARK_IN', 'LOCATION_TRIGGER', 'LOCATION_TRIGGER']);
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

test("a missing speed measurement does not discard valid movement", () => {
  const cleaned = cleanLocationTrack([
    point(17.4219, 78.3845, 0, { speed: null }),
    point(17.4223, 78.3845, 30, { speed: null }),
  ]);
  assert.equal(cleaned.length, 2);
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
