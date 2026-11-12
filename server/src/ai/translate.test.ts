import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heuristicTranslate, extractTimestamp, formatTimestamp } from "./translate.js";

const SAMPLE = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderUser (src/components/UserCard.tsx:42:11)
    at 2024-11-12T10:15:30.000Z`;

describe("heuristicTranslate", () => {
  it("extracts certain facts without inventing lines", () => {
    const r = heuristicTranslate(SAMPLE);
    assert.equal(r.source, "heuristic");
    assert.ok(r.certain.some((c) => c.includes("Cannot read property")));
    assert.ok(r.certain.some((c) => c.includes("UserCard.tsx:42:11")));
    assert.equal(r.checks.length, 3);
    // Must not invent a line that is not in the sample
    assert.ok(!r.certain.some((c) => c.includes(":99:")));
  });

  it("handles a log with no standard exception", () => {
    const r = heuristicTranslate("Something went wrong in the worker process.");
    assert.equal(r.source, "heuristic");
    assert.ok(r.certain.length >= 1);
    assert.equal(r.checks.length, 3);
  });
});

describe("timestamp helpers", () => {
  it("parses an ISO stamp when present", () => {
    const iso = extractTimestamp(SAMPLE);
    assert.ok(iso);
    assert.ok(iso!.startsWith("2024-11-12"));
    const formatted = formatTimestamp(iso);
    assert.equal(formatted, "2024-11-12 10:15:30");
  });

  it("returns undefined when no stamp is present", () => {
    assert.equal(extractTimestamp("no date here"), undefined);
    assert.equal(formatTimestamp(undefined), null);
  });
});
