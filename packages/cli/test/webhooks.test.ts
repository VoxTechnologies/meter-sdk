import { test } from "node:test";
import assert from "node:assert/strict";
import { runWebhooksCreate, runWebhooksList } from "../src/commands/webhooks.js";
import { stubContext } from "./helpers.js";

const service = { id: "svc", name: "Svc", creditName: "credits" };

test("webhooks create posts url/events and prints the secret once", async () => {
  const { ctx, calls, lines } = stubContext(() => ({
    service,
    endpoint: { id: "wh_1", url: "https://x.example/hook", events: ["*"], status: "active", mode: "push" },
    signingSecret: "meter_whsec_abc",
  }));
  await runWebhooksCreate(ctx, "https://x.example/hook", ["usage.committed"]);
  assert.deepEqual(calls[0]?.body, { url: "https://x.example/hook", events: ["usage.committed"] });
  assert.match(lines.join("\n"), /meter_whsec_abc/);
});

test("webhooks list shows endpoints and recent deliveries", async () => {
  const { ctx, lines } = stubContext(() => ({
    service,
    endpoints: [{ id: "wh_1", url: "https://x.example/hook", events: ["*"], status: "active", mode: "push", createdAt: 0, updatedAt: 0 }],
    deliveries: [{ id: "wd_1", endpointId: "wh_1", eventType: "usage.committed", status: "delivered", attemptCount: 1, createdAt: 0, updatedAt: 0, nextAttemptAt: 0, serviceId: "svc", eventId: "evt_1" }],
  }));
  await runWebhooksList(ctx);
  const output = lines.join("\n");
  assert.match(output, /wh_1/);
  assert.match(output, /usage\.committed\s+delivered/);
});
