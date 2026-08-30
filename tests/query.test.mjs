import assert from "node:assert/strict";
import test from "node:test";

import { escapeRegex, pagination } from "../lib/query.mjs";
import { detectDocumentType } from "../lib/documentFile.mjs";

test("escapeRegex treats search input as literal text", () => {
  const input = "(holiday)+[2026]?";
  assert.equal(new RegExp(escapeRegex(input)).test(input), true);
});

test("pagination rejects invalid values and caps large limits", () => {
  assert.deepEqual(pagination(new URLSearchParams("page=-2&limit=0")), { page: 1, limit: 10 });
  assert.deepEqual(pagination(new URLSearchParams("page=3&size=1000")), { page: 3, limit: 100 });
});

test("document type detection accepts real signatures regardless of client MIME", () => {
  assert.equal(detectDocumentType(Buffer.from("%PDF-1.7"))?.mimeType, "application/pdf");
  assert.equal(detectDocumentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mimeType, "image/jpeg");
  assert.equal(
    detectDocumentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mimeType,
    "image/png",
  );
  assert.equal(detectDocumentType(Buffer.from("not a supported document")), null);
});
