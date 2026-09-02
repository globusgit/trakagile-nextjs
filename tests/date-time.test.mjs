import assert from "node:assert/strict";
import test from "node:test";
import { zonedDayKey } from "../lib/dateTime.mjs";

test("the same instant resolves to each organization's local attendance date", () => {
  const instant = new Date("2026-09-02T23:30:00.000Z");
  assert.equal(zonedDayKey(instant, "America/New_York"), "2026-09-02");
  assert.equal(zonedDayKey(instant, "Asia/Kolkata"), "2026-09-03");
  assert.equal(zonedDayKey(instant, "Pacific/Auckland"), "2026-09-03");
});

test("attendance dates remain correct across daylight-saving transitions", () => {
  assert.equal(zonedDayKey(new Date("2026-03-08T06:30:00.000Z"), "America/New_York"), "2026-03-08");
  assert.equal(zonedDayKey(new Date("2026-11-01T05:30:00.000Z"), "America/New_York"), "2026-11-01");
});
