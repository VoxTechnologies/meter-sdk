import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTs, renderTable } from "../src/output.js";

test("renderTable pads columns and includes a header rule", () => {
  const table = renderTable(
    [
      { tool: "echo", credits: 1 },
      { tool: "summarize", credits: 5 },
    ],
    ["tool", "credits"]
  );
  const lines = table.split("\n");
  assert.equal(lines.length, 4);
  assert.match(lines[0]!, /^tool\s+credits$/);
  assert.match(lines[1]!, /^-+\s+-+$/);
  assert.match(lines[3]!, /^summarize\s+5$/);
});

test("formatTs renders UTC seconds and dashes for garbage", () => {
  assert.equal(formatTs(Date.UTC(2026, 6, 15, 14, 2, 11)), "2026-07-15 14:02:11");
  assert.equal(formatTs(Number.NaN), "-");
});
