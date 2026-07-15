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
import {
  runBalance,
  runCustomersGet,
  runCustomersGrant,
  runCustomersList,
  runCustomersSetStatus,
  runKeysCreate,
  runKeysList,
  runKeysRevoke,
  runLedger,
} from "./commands/customers.js";
import { runEventsTail, runUsage } from "./commands/usage.js";
import { runCall } from "./commands/call.js";
import { runInit } from "./commands/init.js";
import {
  runListen,
  runWebhooksCreate,
  runWebhooksDelete,
  runWebhooksList,
  runWebhooksTest,
} from "./commands/webhooks.js";
import { CliError } from "./config.js";
import { nodeIo, createContext, type CliContext } from "./context.js";

const require = createRequire(import.meta.url);
export const cliVersion = (require("../package.json") as { version: string }).version;

export const program = new Command("meter")
  .description("Meter CLI for MCP service providers")
  .version(cliVersion)
  .option("--profile <name>", "config profile")
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
      {
        profile: opts.profile ?? "default",
        baseUrl: opts.baseUrl,
        serviceId: opts.serviceId,
        apiKey: opts.apiKey,
      },
      nodeIo()
    );
  });

program
  .command("logout")
  .description("Remove the profile")
  .action(() => {
    runLogout({ profile: program.opts().profile ?? "default" }, nodeIo());
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

const keys = program.command("keys").description("Manage service API keys");

keys
  .command("list")
  .description("List API keys")
  .action(async () => {
    await runKeysList(contextFromProgram());
  });

keys
  .command("create [name]")
  .description("Create an API key (prints the secret once)")
  .action(async (name) => {
    await runKeysCreate(contextFromProgram(), name);
  });

keys
  .command("revoke <id>")
  .description("Revoke an API key")
  .action(async (id) => {
    await runKeysRevoke(contextFromProgram(), id);
  });

const customers = program.command("customers").description("Manage customer accounts");

customers
  .command("list")
  .description("List customer accounts")
  .option("--limit <n>", "max rows to return", Number)
  .action(async (opts) => {
    await runCustomersList(contextFromProgram(), opts.limit);
  });

customers
  .command("get <localId>")
  .description("Show a customer account")
  .action(async (localId) => {
    await runCustomersGet(contextFromProgram(), localId);
  });

customers
  .command("grant <localId> <credits>")
  .description("Grant (or claw back, if negative) credits to a customer")
  .option("--reason <text>", "note attached to the adjustment")
  .action(async (localId, credits, opts) => {
    await runCustomersGrant(contextFromProgram(), localId, Number(credits), { reason: opts.reason });
  });

customers
  .command("suspend <localId>")
  .description("Suspend a customer account")
  .action(async (localId) => {
    await runCustomersSetStatus(contextFromProgram(), localId, "suspended");
  });

customers
  .command("resume <localId>")
  .description("Resume a suspended customer account")
  .action(async (localId) => {
    await runCustomersSetStatus(contextFromProgram(), localId, "active");
  });

program
  .command("balance <localId>")
  .description("Show a customer's balance")
  .action(async (localId) => {
    await runBalance(contextFromProgram(), localId);
  });

program
  .command("ledger <localId>")
  .description("Show a customer's ledger")
  .option("--limit <n>", "max rows to return", Number)
  .action(async (localId, opts) => {
    await runLedger(contextFromProgram(), localId, opts.limit);
  });

program
  .command("usage")
  .description("Show usage rollups")
  .option("--by <tool|customer>", "rollup dimension")
  .option("--limit <n>", "max recent events to fetch", Number)
  .action(async (opts) => {
    await runUsage(contextFromProgram(), { by: opts.by, limit: opts.limit });
  });

const events = program.command("events").description("Inspect usage events");

events
  .command("tail")
  .description("Follow new usage events")
  .option("--customer <localId>", "filter by customer")
  .option("--tool <name>", "filter by tool")
  .option("--interval <ms>", "poll interval in milliseconds", Number)
  .action(async (opts) => {
    await runEventsTail(contextFromProgram(), {
      customer: opts.customer,
      tool: opts.tool,
      intervalMs: opts.interval,
    });
  });

const webhooks = program.command("webhooks").description("Manage webhook endpoints");

webhooks
  .command("list")
  .description("List webhook endpoints and recent deliveries")
  .action(async () => {
    await runWebhooksList(contextFromProgram());
  });

webhooks
  .command("create <url>")
  .description("Create a push webhook endpoint (prints the signing secret once)")
  .option("--events <a,b>", "comma-separated event types")
  .action(async (url, opts) => {
    await runWebhooksCreate(
      contextFromProgram(),
      url,
      opts.events ? String(opts.events).split(",") : undefined
    );
  });

webhooks
  .command("delete <id>")
  .description("Disable a webhook endpoint")
  .action(async (id) => {
    await runWebhooksDelete(contextFromProgram(), id);
  });

webhooks
  .command("test")
  .description("Send a test event to all registered endpoints")
  .action(async () => {
    await runWebhooksTest(contextFromProgram());
  });

program
  .command("listen")
  .description("Stream provider webhooks to your terminal or a local URL")
  .option("--forward-to <url>", "POST received events to this local URL")
  .option("--events <list>", "comma-separated event filter", "*")
  .action(async (options: { forwardTo?: string; events: string }) => {
    const controller = new AbortController();
    process.once("SIGINT", () => controller.abort());
    await runListen(contextFromProgram(), {
      forwardTo: options.forwardTo,
      events: options.events.split(",").map((event) => event.trim()),
      signal: controller.signal,
    });
  });

program
  .command("call <tool>")
  .description("Call an MCP tool for testing (direct to --url, or via the gateway)")
  .option("--args <json>", "JSON-encoded tool arguments")
  .option("--customer <localId>", "buyer customer local ID", "cli-test")
  .option("--url <mcpUrl>", "call a local MCP server directly instead of the gateway")
  .option("--grant <credits>", "initial credits to grant a newly created test customer", Number)
  .action(async (tool, opts) => {
    await runCall(contextFromProgram(), {
      tool,
      args: opts.args,
      customer: opts.customer,
      url: opts.url,
      grantCredits: opts.grant,
    });
  });

program
  .command("init [name]")
  .description("Scaffold an embedded-metering MCP server and register its Meter service")
  .option("--dir <path>", "target directory (defaults to the project name)")
  .option("--onboarding-key <key>", "onboarding API key used to create the service")
  .option("--use-profile <name>", "reuse an existing profile's service instead of creating one")
  .option("--no-install", "skip running npm install in the new project")
  .action(async (name, opts) => {
    // --base-url is the root-level global option; it captures the flag before the
    // subcommand does, so read it from program.opts() rather than the local opts.
    await runInit({
      name,
      dir: opts.dir,
      baseUrl: program.opts().baseUrl,
      onboardingKey: opts.onboardingKey,
      useProfile: opts.useProfile,
      install: opts.install,
      io: nodeIo(),
    });
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
