import type { CliContext } from "../context.js";
import { emit, formatTs, renderTable } from "../output.js";

export async function runUsage(
  ctx: CliContext,
  opts: { by?: "tool" | "customer"; limit?: number }
): Promise<void> {
  const report = await ctx.client.usage(opts.limit ?? 50);
  const rollups = opts.by === "customer" ? report.byCustomer : report.byTool;
  const keyColumn = opts.by === "customer" ? "customerId" : "tool";
  const rows = rollups.map((rollup) => ({
    [keyColumn]: rollup.tool ?? rollup.customerId ?? rollup.name ?? "-",
    calls: rollup.calls ?? 0,
    credits: rollup.credits ?? 0,
    usd: rollup.usd !== undefined ? `$${rollup.usd.toFixed(2)}` : "-",
  }));
  emit(
    ctx,
    rows.length
      ? renderTable(rows, [keyColumn, "calls", "credits", "usd"]).split("\n")
      : ["No usage yet."],
    { by: opts.by ?? "tool", rollups, creditUsd: report.creditUsd, aiCosts: report.aiCosts }
  );
}

export async function runEventsTail(
  ctx: CliContext,
  opts: {
    customer?: string;
    tool?: string;
    intervalMs?: number;
    iterations?: number;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<void> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const seenAtCursor = new Set<string>();
  let cursorTs = 0;
  let first = true;
  for (let i = 0; opts.iterations === undefined || i < opts.iterations; i++) {
    const report = await ctx.client.usage(50);
    const events = [...report.recent].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
    for (const event of events) {
      if (event.ts < cursorTs || (event.ts === cursorTs && seenAtCursor.has(event.id))) continue;
      if (event.ts > cursorTs) {
        cursorTs = event.ts;
        seenAtCursor.clear();
      }
      seenAtCursor.add(event.id);
      if (first) continue; // the first snapshot is history, not the tail
      if (opts.customer && event.customerLocalId !== opts.customer) continue;
      if (opts.tool && event.tool !== opts.tool) continue;
      if (ctx.json) {
        ctx.io.out(JSON.stringify(event));
      } else {
        ctx.io.out(
          `${formatTs(event.ts)}  ${event.tool.padEnd(24)} ${String(event.credits).padStart(6)} cr  ${event.customerLocalId}`
        );
      }
    }
    first = false;
    if (opts.iterations === undefined || i < opts.iterations - 1) {
      await sleep(opts.intervalMs ?? 2500);
    }
  }
}
