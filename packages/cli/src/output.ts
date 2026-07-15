import type { CliContext } from "./context.js";

export function renderTable(
  rows: Array<Record<string, unknown>>,
  columns: string[]
): string {
  const cell = (value: unknown) => (value === undefined || value === null ? "" : String(value));
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => cell(row[column]).length))
  );
  const line = (values: string[]) =>
    values.map((value, i) => value.padEnd(widths[i]!)).join("  ").trimEnd();
  return [
    line(columns),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map((row) => line(columns.map((column) => cell(row[column])))),
  ].join("\n");
}

export function formatTs(ts: number): string {
  if (!Number.isFinite(ts)) return "-";
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
}

export function emit(ctx: CliContext, humanLines: string[], jsonValue: unknown): void {
  if (ctx.json) {
    ctx.io.out(JSON.stringify(jsonValue, null, 2));
    return;
  }
  for (const line of humanLines) ctx.io.out(line);
}
