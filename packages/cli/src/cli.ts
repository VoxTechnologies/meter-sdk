#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Command } from "commander";

const require = createRequire(import.meta.url);
export const cliVersion = (require("../package.json") as { version: string }).version;

export const program = new Command("meter")
  .description("Meter CLI for MCP service providers")
  .version(cliVersion);

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
  program.parseAsync(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
