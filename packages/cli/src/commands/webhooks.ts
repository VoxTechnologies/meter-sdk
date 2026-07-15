import { createHmac } from "node:crypto";
import type { MeterPolledWebhookDelivery } from "@meter-mcp/sdk";
import type { CliContext, CliIo } from "../context.js";
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

export async function runListen(
  ctx: CliContext,
  opts: {
    forwardTo?: string;
    events?: string[];
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    maxPolls?: number;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const created = await ctx.client.createWebhookEndpoint({
    mode: "poll",
    events: opts.events ?? ["*"],
  });
  ctx.io.out(`Signing secret (put it in your local .env to verify): ${created.signingSecret}`);
  ctx.io.out(
    opts.forwardTo ? `Forwarding events to ${opts.forwardTo} ...` : "Observing events (no --forward-to) ..."
  );
  try {
    for (let polls = 0; opts.maxPolls === undefined || polls < opts.maxPolls; polls++) {
      if (opts.signal?.aborted) break;
      let deliveries: MeterPolledWebhookDelivery[];
      try {
        ({ deliveries } = await ctx.client.pollWebhookDeliveries(created.endpoint.id, { wait: 25 }));
      } catch (error) {
        if (opts.signal?.aborted) break;
        ctx.io.err(`poll failed, retrying in 5s: ${error instanceof Error ? error.message : String(error)}`);
        await sleep(5000);
        continue;
      }
      if (deliveries.length === 0) continue;
      // Ack on receipt: redelivery from here on is this session's local retry loop.
      await ctx.client.ackWebhookDeliveries(created.endpoint.id, deliveries.map((d) => d.id));
      for (const delivery of deliveries) {
        if (!opts.forwardTo) {
          ctx.io.out(`${formatTs(delivery.createdAt)}  ${delivery.eventType}  ${JSON.stringify(delivery.payload)}`);
          continue;
        }
        await forwardDelivery(fetchImpl, opts.forwardTo, created.signingSecret, delivery, sleep, ctx.io);
      }
    }
  } finally {
    await ctx.client.disableWebhookEndpoint(created.endpoint.id).catch(() => undefined);
  }
}

async function forwardDelivery(
  fetchImpl: typeof fetch,
  url: string,
  secret: string,
  delivery: MeterPolledWebhookDelivery,
  sleep: (ms: number) => Promise<void>,
  io: CliIo
): Promise<void> {
  const body = JSON.stringify(delivery.payload);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const suffix = attempt < 3 ? " (retrying)" : " (gave up)";
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-meter-signature": `t=${timestamp},v1=${signature}`,
          "x-meter-event-id": delivery.eventId,
          "user-agent": "meter-cli/listen",
        },
        body,
      });
      io.out(
        `${formatTs(delivery.createdAt)}  ${delivery.eventType.padEnd(22)} -> ${response.status}${response.ok ? "" : suffix}`
      );
      if (response.ok) return;
    } catch (error) {
      io.out(
        `${formatTs(delivery.createdAt)}  ${delivery.eventType.padEnd(22)} -> error: ${error instanceof Error ? error.message : String(error)}${suffix}`
      );
    }
    if (attempt < 3) await sleep(2000);
  }
}
