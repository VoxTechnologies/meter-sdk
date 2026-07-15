import { test } from "node:test";
import assert from "node:assert/strict";
import { runEventsTail, runUsage } from "../src/commands/usage.js";
import { stubContext } from "./helpers.js";

const service = { id: "svc", name: "Svc", creditName: "credits" };
const emptyReport = {
  service, creditUsd: 0.01, byCustomer: [], byTool: [], byProduct: [],
  revenueShare: [], recent: [], aiCosts: { totalCostUsd: 0 },
};

test("usage renders byTool rollups", async () => {
  const { ctx, lines } = stubContext(() => ({
    ...emptyReport,
    byTool: [{ tool: "echo", calls: 3, credits: 3, usd: 0.03 }],
  }));
  await runUsage(ctx, { by: "tool" });
  assert.match(lines.join("\n"), /echo\s+3\s+3/);
});

test("events tail prints only events newer than the first snapshot", async () => {
  const first = { id: "e1", ts: 1000, tool: "echo", credits: 1, customerLocalId: "alice", serviceId: "svc", customerName: "Alice", provider: "platform" };
  const second = { ...first, id: "e2", ts: 2000, tool: "summarize", credits: 5 };
  let fetches = 0;
  const { ctx, lines } = stubContext(() => {
    fetches += 1;
    return { ...emptyReport, recent: fetches === 1 ? [first] : [second, first] };
  });
  await runEventsTail(ctx, { iterations: 2, sleep: async () => {} });
  const output = lines.join("\n");
  assert.doesNotMatch(output, /e1|echo /);
  assert.match(output, /summarize/);
});

test("events tail honors --tool filter", async () => {
  const base = { id: "e1", ts: 1000, tool: "echo", credits: 1, customerLocalId: "alice", serviceId: "svc", customerName: "Alice", provider: "platform" };
  let fetches = 0;
  const { ctx, lines } = stubContext(() => {
    fetches += 1;
    return {
      ...emptyReport,
      recent: fetches === 1 ? [] : [{ ...base, id: "e2", ts: 2000 }, { ...base, id: "e3", ts: 2001, tool: "summarize" }],
    };
  });
  await runEventsTail(ctx, { tool: "summarize", iterations: 2, sleep: async () => {} });
  assert.doesNotMatch(lines.join("\n"), /echo/);
  assert.match(lines.join("\n"), /summarize/);
});
