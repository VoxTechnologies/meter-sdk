import type { CliContext } from "../context.js";
import { CliError } from "../config.js";
import { emit, renderTable } from "../output.js";

function compact<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

export async function runServicesGet(ctx: CliContext): Promise<void> {
  const { service, gatewayUrl } = await ctx.client.getIntegration();
  emit(
    ctx,
    [
      `id           ${service.id}`,
      `name         ${service.name}`,
      `credit name  ${service.creditName}`,
      `brand color  ${service.brandColor}`,
      `support      ${service.supportEmail ?? "-"}`,
      `gateway URL  ${gatewayUrl}`,
    ],
    { service, gatewayUrl }
  );
}

export async function runServicesUpdate(
  ctx: CliContext,
  opts: {
    name?: string;
    creditName?: string;
    brandColor?: string;
    supportEmail?: string;
    termsUrl?: string;
    privacyUrl?: string;
  }
): Promise<void> {
  const update = compact(opts);
  if (Object.keys(update).length === 0) throw new CliError("nothing to update: pass at least one flag");
  const { service } = await ctx.client.updateService(update);
  emit(ctx, [`Updated service ${service.id}.`], { service });
}

export async function runIntegrationGet(ctx: CliContext): Promise<void> {
  const { integration, gatewayUrl } = await ctx.client.getIntegration();
  if (!integration) {
    emit(ctx, ["No integration configured yet."], { integration: null, gatewayUrl });
    return;
  }
  emit(
    ctx,
    [
      `gateway        ${integration.gatewayEnabled ? "enabled" : "disabled"}  (${gatewayUrl})`,
      `upstream       ${integration.upstreamUrl ?? "-"} (${integration.upstreamAuthMode})`,
      `customer auth  ${integration.customerAuthMode}`,
      `auto-provision ${integration.autoProvisionCustomers} (default ${integration.defaultCredits} credits)`,
      `tool prices    ${Object.keys(integration.toolPrices).length} tools (use "meter prices list")`,
    ],
    { integration, gatewayUrl }
  );
}

export async function runIntegrationUpdate(
  ctx: CliContext,
  opts: {
    gatewayEnabled?: boolean;
    upstreamUrl?: string;
    upstreamAuthMode?: "none" | "bearer" | "header" | "oauth_client_credentials";
    upstreamAuthHeader?: string;
    upstreamAuthSecret?: string;
    customerAuthMode?: "api_key" | "jwt";
    autoProvisionCustomers?: boolean;
    defaultCredits?: number;
  }
): Promise<void> {
  const update = compact(opts);
  if (Object.keys(update).length === 0) throw new CliError("nothing to update: pass at least one flag");
  const { integration } = await ctx.client.updateIntegration(update);
  emit(ctx, [`Updated integration for ${integration.serviceId}.`], { integration });
}

export async function runPricesList(ctx: CliContext): Promise<void> {
  const [{ integration }, report] = await Promise.all([
    ctx.client.getIntegration(),
    ctx.client.usage(1),
  ]);
  const toolPrices = integration?.toolPrices ?? {};
  const rows = Object.entries(toolPrices).map(([tool, credits]) => ({
    tool,
    credits,
    usd: `$${(credits * report.creditUsd).toFixed(2)}`,
  }));
  emit(
    ctx,
    rows.length
      ? renderTable(rows, ["tool", "credits", "usd"]).split("\n")
      : ["No tool prices configured."],
    { creditUsd: report.creditUsd, toolPrices }
  );
}

export async function runPricesSet(ctx: CliContext, tool: string, credits: number): Promise<void> {
  if (!Number.isSafeInteger(credits) || credits <= 0) {
    throw new CliError("credits must be a positive integer");
  }
  const { integration } = await ctx.client.getIntegration();
  const toolPrices = { ...(integration?.toolPrices ?? {}), [tool]: credits };
  await ctx.client.updateIntegration({ toolPrices });
  emit(ctx, [`Set ${tool} = ${credits} credits.`], { toolPrices });
}
