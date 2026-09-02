import assert from "node:assert/strict";
import test from "node:test";
import { formatRegionalCurrency, formatRegionalDateTime, formatRegionalNumber } from "../lib/regionalFormat.mjs";

test("currency formatting follows organization locale and currency", () => {
  assert.match(formatRegionalCurrency(1234.5, { locale: "en-US", currency: "USD" }), /\$1,234\.50/);
  assert.match(formatRegionalCurrency(1234.5, { locale: "de-DE", currency: "EUR" }), /1\.234,50/);
});

test("date-time formatting uses organization timezone", () => {
  const instant = "2026-09-02T23:30:00.000Z";
  assert.match(formatRegionalDateTime(instant, { locale: "en-US", timeZone: "America/New_York" }), /Sep 02, 2026/);
  assert.match(formatRegionalDateTime(instant, { locale: "en-GB", timeZone: "Asia/Kolkata" }), /03 Sept 2026/);
});

test("number formatting follows locale grouping", () => {
  assert.equal(formatRegionalNumber(1234567.89, { locale: "en-US" }), "1,234,567.89");
  assert.equal(formatRegionalNumber(1234567.89, { locale: "en-IN" }), "12,34,567.89");
});
