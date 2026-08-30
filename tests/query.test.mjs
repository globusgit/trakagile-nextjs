import assert from "node:assert/strict";
import test from "node:test";

import { escapeRegex, pagination } from "../lib/query.mjs";

test("escapeRegex treats search input as literal text", () => {
  const input = "(holiday)+[2026]?";
  assert.equal(new RegExp(escapeRegex(input)).test(input), true);
});

test("pagination rejects invalid values and caps large limits", () => {
  assert.deepEqual(pagination(new URLSearchParams("page=-2&limit=0")), { page: 1, limit: 10 });
  assert.deepEqual(pagination(new URLSearchParams("page=3&size=1000")), { page: 3, limit: 100 });
});
