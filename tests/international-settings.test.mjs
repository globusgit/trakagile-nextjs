import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInternationalSettings } from "../lib/internationalSettings.mjs";

test("international settings normalize ISO values", () => {
  assert.deepEqual(normalizeInternationalSettings({ timeZone: "Europe/London", locale: "en-GB", currency: "gbp", countryCode: "gb", weekStartsOn: 1 }), { timeZone: "Europe/London", locale: "en-GB", currency: "GBP", countryCode: "GB", weekStartsOn: 1 });
});

test("international settings reject invalid regional configuration", () => {
  assert.throws(() => normalizeInternationalSettings({ timeZone: "Mars/Olympus" }), /valid locale/);
  assert.throws(() => normalizeInternationalSettings({ currency: "RUPEES" }), /three-letter/);
  assert.throws(() => normalizeInternationalSettings({ weekStartsOn: 8 }), /Sunday and Saturday/);
});
