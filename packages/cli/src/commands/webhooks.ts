import type { CliContext } from "../context.js";
import { emit, formatTs, renderTable } from "../output.js";

export async function runWebhooksList(ctx: CliContext): Promise<void> {
  const { endpoints, deliveries } = await ctx.client.listWebhookEndpoints();
  const endpointRows = endpoints.map((endpoint) => ({
    id: endpoint.id,
    mode: endpoint.mode,
    url: endpoint.url || "(poll)",
    events: endpoint.events.join(","),
    status: endpoint.status,
  }));
  const deliveryRows = deliveries.map((delivery) => ({
    ts: formatTs(delivery.createdAt),
    event: delivery.eventType,
    status: delivery.status,
    attempts: delivery.attemptCount,
    error: delivery.lastError ?? "",
  }));
  emit(
    ctx,
    [
      ...(endpointRows.length
        ? renderTable(endpointRows, ["id", "mode", "url", "events", "status"]).split("\n")
        : ["No webhook endpoints."]),
      "",
      ...(deliveryRows.length
        ? renderTable(deliveryRows, ["ts", "event", "status", "attempts", "error"]).split("\n")
        : ["No recent deliveries."]),
    ],
    { endpoints, deliveries }
  );
}

export async function runWebhooksCreate(
  ctx: CliContext,
  url: string,
  events?: string[]
): Promise<void> {
  const created = await ctx.client.createWebhookEndpoint({ url, events });
  emit(
    ctx,
    [
      `Created endpoint ${created.endpoint.id} -> ${url}`,
      `Signing secret (shown only once): ${created.signingSecret}`,
    ],
    created
  );
}

export async function runWebhooksDelete(ctx: CliContext, endpointId: string): Promise<void> {
  await ctx.client.disableWebhookEndpoint(endpointId);
  emit(ctx, [`Disabled endpoint ${endpointId}.`], { disabled: endpointId });
}

export async function runWebhooksTest(ctx: CliContext): Promise<void> {
  const result = await ctx.client.testWebhooks();
  emit(
    ctx,
    [`Sent test event ${result.eventId} to ${result.deliveryCount} endpoint(s).`],
    result
  );
}
