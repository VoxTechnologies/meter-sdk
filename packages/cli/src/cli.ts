#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { MeterPublicApiError } from "@meter-mcp/sdk";
import { runLogin, runLogout, runWhoami } from "./commands/auth.js";
import {
  runIntegrationGet,
  runIntegrationUpdate,
  runPricesList,
  runPricesSet,
  runServicesGet,
  runServicesUpdate,
} from "./commands/services.js";
import { CliError } from "./config.js";
import { nodeIo, createContext, type CliContext } from "./context.js";

const require = createRequire(import.meta.url);
export const cliVersion = (require("../package.json") as { version: string }).version;

export const program = new Command("meter")
  .description("Meter CLI for MCP service providers")
  .version(cliVersion)
  .option("--profile <name>", "config profile", "default")
  .option("--json", "machine-readable output")
  .option("--base-url <url>", "override the profile's base URL")
  .option("--service-id <id>", "override the profile's service ID")
  .option("--api-key <key>", "override the profile's API key");

function contextFromProgram(): CliContext {
  const opts = program.opts();
  return createContext(
    {
      profile: opts.profile,
      baseUrl: opts.baseUrl,
      serviceId: opts.serviceId,
      apiKey: opts.apiKey,
      json: Boolean(opts.json),
    },
    nodeIo()
  );
}

program
  .command("login")
  .description("Save credentials for a Meter service")
  .action(async () => {
    const opts = program.opts();
    await runLogin(
      { profile: opts.profile, baseUrl: opts.baseUrl, serviceId: opts.serviceId, apiKey: opts.apiKey },
      nodeIo()
    );
  });

program
  .command("logout")
  .description("Remove the profile")
  .action(() => {
    runLogout({ profile: program.opts().profile }, nodeIo());
  });

program
  .command("whoami")
  .description("Show the authenticated service")
  .action(async () => {
    await runWhoami(contextFromProgram());
  });

const services = program.command("services").description("Manage the service profile");

services
  .command("get")
  .description("Show the service profile")
  .action(async () => {
    await runServicesGet(contextFromProgram());
  });

services
  .command("update")
  .description("Update the service profile")
  .option("--name <name>", "display name")
  .option("--credit-name <name>", "name used for the credit unit")
  .option("--brand-color <color>", "brand color")
  .option("--support-email <email>", "support email")
  .option("--terms-url <url>", "terms of service URL")
  .option("--privacy-url <url>", "privacy policy URL")
  .action(async (opts) => {
    await runServicesUpdate(contextFromProgram(), {
      name: opts.name,
      creditName: opts.creditName,
      brandColor: opts.brandColor,
      supportEmail: opts.supportEmail,
      termsUrl: opts.termsUrl,
      privacyUrl: opts.privacyUrl,
    });
  });

const integration = program.command("integration").description("Manage the gateway integration");

integration
  .command("get")
  .description("Show the gateway integration")
  .action(async () => {
    await runIntegrationGet(contextFromProgram());
  });

integration
  .command("update")
  .description("Update the gateway integration")
  .option("--gateway-enabled <bool>", "enable or disable the gateway", (v) => v === "true")
  .option("--upstream-url <url>", "upstream MCP server URL")
  .option("--upstream-auth-mode <mode>", "none | bearer | header | oauth_client_credentials")
  .option("--upstream-auth-header <header>", "header name for header auth mode")
  .option("--upstream-auth-secret <secret>", "upstream auth secret")
  .option("--customer-auth-mode <mode>", "api_key | jwt")
  .option("--auto-provision-customers <bool>", "auto-provision unknown customers", (v) => v === "true")
  .option("--default-credits <n>", "default credits granted on auto-provision", Number)
  .action(async (opts) => {
    await runIntegrationUpdate(contextFromProgram(), {
      gatewayEnabled: opts.gatewayEnabled,
      upstreamUrl: opts.upstreamUrl,
      upstreamAuthMode: opts.upstreamAuthMode,
      upstreamAuthHeader: opts.upstreamAuthHeader,
      upstreamAuthSecret: opts.upstreamAuthSecret,
      customerAuthMode: opts.customerAuthMode,
      autoProvisionCustomers: opts.autoProvisionCustomers,
      defaultCredits: opts.defaultCredits,
    });
  });

const prices = program.command("prices").description("Manage per-tool credit prices");

prices
  .command("list")
  .description("List tool prices with their USD equivalent")
  .action(async () => {
    await runPricesList(contextFromProgram());
  });

prices
  .command("set <tool> <credits>")
  .description("Set the credit price for a tool")
  .action(async (tool, credits) => {
    await runPricesSet(contextFromProgram(), tool, Number(credits));
  });

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
