#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { MeterPublicApiError } from "@meter-mcp/sdk";
import { CliError } from "./config.js";

const require = createRequire(import.meta.url);
export const cliVersion = (require("../package.json") as { version: string }).version;

export const program = new Command("meter")
  .description("Meter CLI for MCP service providers")
  .version(cliVersion);

export function handleError(error: unknown): void {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exitCode = error.exitCode;
    return;
  }
  if (error instanceof MeterPublicApiError) {
    console.error(`API error ${error.status} on ${error.path}: ${JSON.stringify(error.body)}`);
    process.exitCode = 1;
    return;
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

// Only parse when executed as a bin — importing this module (tests) must not parse argv.
// argv[1] is resolved through realpathSync because npm's bin shim (npx / npm i -g)
// invokes this file through a symlink, while import.meta.url is already realpath-resolved.
function mainScriptHref(): string | undefined {
  const argv1 = process.argv[1];
  if (argv1 === undefined) return undefined;
  try {
    return pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return pathToFileURL(argv1).href;
  }
}
const isMain = import.meta.url === mainScriptHref();
if (isMain) {
  program.parseAsync(process.argv).catch(handleError);
}
