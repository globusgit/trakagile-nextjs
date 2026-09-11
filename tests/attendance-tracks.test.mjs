import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const SRC_URL = new URL("../lib/attendanceTracks.js", import.meta.url);
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

function fixture({ aggregateResult = [], attendances = [] } = {}) {
  const calls = [];
  const deps = {
    [resolveDep("@/models/TrackingLocation")]: {
      default: { aggregate: async (...args) => { calls.push(args); return aggregateResult; } },
    },
    [resolveDep("@/lib/locationTrack.mjs")]: {
      cleanLocationTrack: (points) => {
        const sorted = (points || []).filter((p) =>
          Number.isFinite(p?.latitude) && Number.isFinite(p?.longitude)
            && (p.accuracy == null || p.accuracy <= 50),
        ).sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
        const accepted = [];
        for (const point of sorted) {
          const prev = accepted.at(-1);
          if (!prev) { accepted.push(point); continue; }
          const elapsed = (new Date(point.capturedAt) - new Date(prev.capturedAt)) / 1000;
          if (elapsed <= 0) continue;
          const lat1 = prev.latitude * Math.PI / 180, lat2 = point.latitude * Math.PI / 180;
          const dLat = (point.latitude - prev.latitude) * Math.PI / 180;
          const dLon = (point.longitude - prev.longitude) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
          const dist = 6371000 * 2 * Math.asin(Math.sqrt(a));
          const uncertainty = Math.max(12, Math.hypot(Number(prev.accuracy)||0, Number(point.accuracy)||0)*1.5);
          if (dist <= uncertainty) continue;
          accepted.push(point);
        }
        return accepted;
      },
      latestLocation: (...points) => {
        const valid = points.filter((p) =>
          Number.isFinite(p?.latitude) && p.latitude >= -90 && p.latitude <= 90
            && Number.isFinite(p?.longitude) && p.longitude >= -180 && p.longitude <= 180,
        ).sort((a, b) => new Date(b.capturedAt||b.receivedAt||0) - new Date(a.capturedAt||a.receivedAt||0));
        return valid[0] || null;
      },
      locationTriggerPoints: (points, start) => {
        const triggers = (points || []).filter((p) =>
          Number.isFinite(p?.latitude) && Number.isFinite(p?.longitude) && (
            p.minuteTrigger || !start
              || Math.abs(p.latitude - start.latitude) >= 0.000001
              || Math.abs(p.longitude - start.longitude) >= 0.000001
          ),
        ).sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt))
          .map((p) => ({ ...p, type: "LOCATION_TRIGGER" }));
        return start ? [{ ...start, type: "MARK_IN" }, ...triggers] : triggers;
      },
      trackLengthMeters: () => 0,
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => deps[resolveDep(name)], Map, Promise, Date });
  return {
    calls,
    attendanceTracks: async (orgId, atts) => exports.attendanceTracks(orgId, atts || attendances),
  };
}

function makeAttendance(id, overrides = {}) {
  return {
    _id: id, orgId: "org", empId: `emp-${id}`,
    lastKnownLocation: overrides.lastKnownLocation ?? null,
    lastKnownLocationName: overrides.lastKnownLocationName ?? null,
    markOut: overrides.markOut ?? null,
    markIn: overrides.markIn ?? null,
    ...overrides,
  };
}

test("empty attendances returns empty map", async () => {
  const f = fixture();
  const result = await f.attendanceTracks("org", []);
  assert.equal(result instanceof Map, true);
  assert.equal(result.size, 0);
  assert.equal(f.calls.length, 0);
});

test("track aggregation with multiple points", async () => {
  const att = makeAttendance("a1");
  const f = fixture({
    attendances: [att],
    aggregateResult: [{
      _id: "a1",
      points: [
        { _id: "p1", capturedAt: new Date("2026-09-05T08:00:00Z"), latitude: 17.42, longitude: 78.38, accuracy: 10 },
        { _id: "p2", capturedAt: new Date("2026-09-05T08:05:00Z"), latitude: 17.43, longitude: 78.39, accuracy: 10 },
      ],
    }],
  });
  const result = await f.attendanceTracks("org", [att]);
  assert.equal(result.size, 1);
  assert.ok(result.has("a1"));
  assert.equal(result.get("a1").movementPoints.length, 2);
  assert.equal(f.calls.length, 1);
});

test("cleanLocationTrack filters correctly", async () => {
  const att = makeAttendance("a1", {
    lastKnownLocation: { latitude: 17.42, longitude: 78.38, accuracy: 5 },
  });
  const f = fixture({
    attendances: [att],
    aggregateResult: [{
      _id: "a1",
      points: [
        { capturedAt: new Date("2026-09-05T08:00:00Z"), latitude: 17.42, longitude: 78.38, accuracy: 5 },
        { capturedAt: new Date("2026-09-05T08:01:00Z"), latitude: 17.42, longitude: 78.38, accuracy: 60 },
        { capturedAt: new Date("2026-09-05T08:02:00Z"), latitude: 17.43, longitude: 78.39, accuracy: 5 },
      ],
    }],
  });
  const result = await f.attendanceTracks("org", [att]);
  const track = result.get("a1");
  assert.equal(track.movementPoints.length, 2);
  assert.equal(track.movementPoints[0].accuracy, 5);
  assert.equal(track.movementPoints[1].accuracy, 5);
});

test("trackLengthMeters calculation", async () => {
  let capturedDistance = null;
  const deps = {
    [resolveDep("@/models/TrackingLocation")]: { default: { aggregate: async () => [] } },
    [resolveDep("@/lib/locationTrack.mjs")]: {
      cleanLocationTrack: (p) => p,
      latestLocation: (...args) => args[0] || null,
      locationTriggerPoints: (points, start) => start ? [{ ...start, type: "MARK_IN" }, ...(points || [])] : (points || []),
      trackLengthMeters: (points) => {
        capturedDistance = points.length >= 2 ? 150 : 0;
        return capturedDistance;
      },
    },
  };
  const ex = {};
  vm.runInNewContext(compiled, { exports: ex, require: (name) => deps[resolveDep(name)], Map, Promise, Date });
  const result = await ex.attendanceTracks("org", [makeAttendance("a1")]);
  assert.equal(capturedDistance, 0);
  assert.equal(result.get("a1").filteredDistanceMeters, 0);
});

test("latestLocation fallback chain", async () => {
  const f = fixture({
    attendances: [
      makeAttendance("a1", {
        lastKnownLocation: { latitude: 17.40, longitude: 78.35, accuracy: 10, locationName: "SavedPoint" },
        markOut: { location: { latitude: 17.45, longitude: 78.40, accuracy: 5, locationName: "MarkOutPoint" } },
        markIn: { location: { latitude: 17.41, longitude: 78.36, accuracy: 8, locationName: "MarkInPoint" } },
      }),
    ],
    aggregateResult: [{ _id: "a1", points: [
      { capturedAt: new Date("2026-09-05T08:00:00Z"), latitude: 17.40, longitude: 78.35, accuracy: 5, locationName: "SavedPoint" },
    ] }],
  });
  const result = await f.attendanceTracks("org");
  assert.equal(result.get("a1").location.locationName, "SavedPoint");
});

test("locationTriggerPoints filtering", async () => {
  const att = makeAttendance("a1", {
    markIn: { location: { latitude: 17.42, longitude: 78.38, accuracy: 5, locationName: "Start" } },
  });
  const f = fixture({
    attendances: [att],
    aggregateResult: [{
      _id: "a1",
      points: [
        { capturedAt: new Date("2026-09-05T08:00:00Z"), latitude: 17.42, longitude: 78.38, accuracy: 5, minuteTrigger: true },
        { capturedAt: new Date("2026-09-05T08:01:00Z"), latitude: 17.430001, longitude: 78.380001, accuracy: 5, locationNameRefreshed: true },
        { capturedAt: new Date("2026-09-05T08:02:00Z"), latitude: 17.43, longitude: 78.39, accuracy: 5 },
      ],
    }],
  });
  const result = await f.attendanceTracks("org", [att]);
  const track = result.get("a1");
  assert.equal(track.triggerPoints.length, 3);
  assert.equal(track.triggerPoints[0].type, "MARK_IN");
  assert.equal(track.triggerPoints[1].type, "LOCATION_TRIGGER");
  assert.equal(track.triggerPoints[2].type, "LOCATION_TRIGGER");
});
