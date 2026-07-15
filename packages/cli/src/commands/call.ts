import type { CliContext } from "../context.js";
import { CliError, loadCliConfig, saveCliConfig } from "../config.js";
import { emit } from "../output.js";

export async function runCall(
  ctx: CliContext,
  opts: {
    tool: string;
    args?: string;
    customer?: string;
    url?: string;
    grantCredits?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const customer = opts.customer ?? "cli-test";
  let toolArgs: Record<string, unknown>;
  try {
    toolArgs = JSON.parse(opts.args ?? "{}") as Record<string, unknown>;
  } catch {
    throw new CliError("--args must be valid JSON");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  let targetUrl: string;
  if (opts.url) {
    targetUrl = opts.url;
    headers["x-customer-id"] = customer;
  } else {
    const { integration, gatewayUrl } = await ctx.client.getIntegration();
    if (!integration?.gatewayEnabled) {
      throw new CliError(
        "gateway is not enabled for this service; pass --url <your local MCP server URL> instead"
      );
    }
    headers.authorization = `Bearer ${await ensureBuyerKey(ctx, customer, opts.grantCredits ?? 1000)}`;
    targetUrl = gatewayUrl;
  }

  const response = await fetchImpl(targetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: opts.tool, arguments: toolArgs },
    }),
  });
  const rpc = (await parseJsonRpcResponse(response)) as {
    result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean; _meta?: { meter?: unknown } };
    error?: { message?: string };
  };
  if (rpc.error) throw new CliError(`tool call failed: ${rpc.error.message ?? "unknown error"}`);

  const lines: string[] = [];
  for (const item of rpc.result?.content ?? []) {
    lines.push(item.text ?? JSON.stringify(item));
  }
  if (rpc.result?.isError) lines.unshift("Tool returned an error result:");
  const meterMeta = rpc.result?._meta && (rpc.result._meta as { meter?: unknown }).meter;
  if (meterMeta) lines.push(`meter: ${JSON.stringify(meterMeta)}`);

  const { account } = await ctx.client.getCustomerCredits(customer);
  lines.push(`Balance for ${customer}: ${account.balanceCredits} credits`);
  emit(ctx, lines, { result: rpc.result, balance: account.balanceCredits, customer });
}

async function ensureBuyerKey(ctx: CliContext, customer: string, grantCredits: number): Promise<string> {
  if (customer === "cli-test" && ctx.connection.testCustomerApiKey) {
    return ctx.connection.testCustomerApiKey;
  }
  const created = await ctx.client.upsertCustomer({
    customerLocalId: customer,
    name: customer,
    initialCredits: grantCredits,
  });
  if (!created.apiKey) {
    throw new CliError(
      `customer "${customer}" exists but returned no API key; pass --url for a local server or use a fresh --customer id`
    );
  }
  if (customer === "cli-test") {
    // Buyer keys are one-time secrets; cache the test customer's key in the profile.
    const config = loadCliConfig(ctx.configPath);
    const profile = config.profiles[ctx.connection.profileName];
    if (profile) {
      profile.testCustomerApiKey = created.apiKey;
      saveCliConfig(config, ctx.configPath);
    }
  }
  return created.apiKey;
}

async function parseJsonRpcResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (contentType.includes("text/event-stream")) {
    const dataLines = text.split("\n").filter((line) => line.startsWith("data:"));
    const last = dataLines.at(-1);
    if (!last) throw new CliError(`empty event stream (HTTP ${response.status})`);
    return JSON.parse(last.slice("data:".length).trim());
  }
  if (!text) throw new CliError(`empty response (HTTP ${response.status})`);
  return JSON.parse(text);
}
