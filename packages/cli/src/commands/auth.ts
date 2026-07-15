import { MeterPublicApiClient } from "@meter-mcp/sdk";
import { CliError, loadCliConfig, saveCliConfig } from "../config.js";
import type { CliContext, CliIo } from "../context.js";
import { emit } from "../output.js";

const DEFAULT_BASE_URL = "https://meter-mcp.vercel.app";

export async function runLogin(
  opts: { profile: string; baseUrl?: string; serviceId?: string; apiKey?: string; configPath?: string },
  io: CliIo,
  fetchImpl?: typeof fetch
): Promise<void> {
  const baseUrl =
    opts.baseUrl ?? ((await io.prompt(`Base URL [${DEFAULT_BASE_URL}]: `)) || DEFAULT_BASE_URL);
  const serviceId = opts.serviceId ?? (await io.prompt("Service ID: "));
  const apiKey = opts.apiKey ?? (await io.prompt("Service API key: ", { secret: true }));
  if (!serviceId || !apiKey) throw new CliError("service ID and API key are required");

  const client = new MeterPublicApiClient({
    baseUrl,
    serviceId,
    serviceApiKey: apiKey,
    timeoutMs: 30_000,
    fetchImpl,
  });
  // listApiKeys is the cheapest authenticated route — proves the key before saving it.
  const verified = await client.listApiKeys();

  const config = loadCliConfig(opts.configPath);
  // Preserve a previously cached one-time buyer key across a re-login, but only when
  // the same deployment+service is being re-authenticated — a different baseUrl or
  // serviceId makes the cached key stale and wrong for the new target.
  const previous = config.profiles[opts.profile];
  const keepTestKey =
    previous && previous.baseUrl === baseUrl && previous.serviceId === serviceId
      ? previous.testCustomerApiKey
      : undefined;
  config.profiles[opts.profile] = {
    baseUrl,
    serviceId,
    apiKey,
    ...(keepTestKey ? { testCustomerApiKey: keepTestKey } : {}),
  };
  config.activeProfile = opts.profile;
  saveCliConfig(config, opts.configPath);
  io.out(
    `Logged in to ${baseUrl} as "${verified.service.name}" (${serviceId}); profile "${opts.profile}" saved.`
  );
}

export function runLogout(opts: { profile: string; configPath?: string }, io: CliIo): void {
  const config = loadCliConfig(opts.configPath);
  if (!config.profiles[opts.profile]) throw new CliError(`profile "${opts.profile}" not found`);
  delete config.profiles[opts.profile];
  if (config.activeProfile === opts.profile) config.activeProfile = "default";
  saveCliConfig(config, opts.configPath);
  io.out(`Removed profile "${opts.profile}".`);
}

export async function runWhoami(ctx: CliContext): Promise<void> {
  const { service } = await ctx.client.listApiKeys();
  emit(
    ctx,
    [
      `profile   ${ctx.connection.profileName}`,
      `base URL  ${ctx.connection.baseUrl}`,
      `service   ${service.name} (${service.id})`,
    ],
    { profile: ctx.connection.profileName, baseUrl: ctx.connection.baseUrl, service }
  );
}
