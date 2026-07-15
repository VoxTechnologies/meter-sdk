import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { runListen } from "../src/commands/webhooks.js";
import { stubContext, type StubCall } from "./helpers.js";

const service = { id: "svc", name: "Svc", creditName: "credits" };
const delivery = {
  id: "wd_1", endpointId: "wh_poll", serviceId: "svc", eventId: "evt_1",
  eventType: "usage.committed", status: "pending", attemptCount: 0,
  nextAttemptAt: 0, createdAt: 1000, updatedAt: 1000,
  payload: { id: "evt_1", type: "usage.committed", data: { object: { credits: 3 } } },
};

function meterStub(call: StubCall): unknown {
  if (call.path.endsWith("/webhook-endpoints") && call.method === "POST") {
    return { service, endpoint: { id: "wh_poll", mode: "poll", url: "", events: ["*"], status: "active" }, signingSecret: "meter_whsec_test" };
  }
  if (call.path.endsWith("/deliveries/pending")) return { deliveries: [delivery] };
  if (call.path.endsWith("/deliveries/ack")) return { acknowledged: 1 };
  return {}; // DELETE endpoint teardown
}

test("listen polls, acks, forwards with a valid signature, and cleans up", async () => {
  const forwarded: Array<{ body: string; signature: string }> = [];
  const { ctx, calls, lines } = stubContext(meterStub);
  await runListen(ctx, {
    forwardTo: "http://localhost:8787/hook",
    maxPolls: 1,
    sleep: async () => {},
    fetchImpl: async (input, init) => {
      assert.equal(String(input), "http://localhost:8787/hook");
      forwarded.push({
        body: String(init?.body),
        signature: new Headers(init?.headers).get("x-meter-signature") ?? "",
      });
      return new Response(null, { status: 200 });
    },
  });

  assert.equal(forwarded.length, 1);
  const match = forwarded[0]!.signature.match(/^t=(\d+),v1=([a-f0-9]{64})$/);
  assert.ok(match, "signature header shape");
  const expected = createHmac("sha256", "meter_whsec_test")
    .update(`${match![1]}.${forwarded[0]!.body}`)
    .digest("hex");
  assert.equal(match![2], expected);

  const paths = calls.map((call) => `${call.method} ${call.path}`);
  assert.ok(paths.some((p) => p.endsWith("/deliveries/ack")), "acked");
  assert.ok(paths.some((p) => p.startsWith("DELETE")), "endpoint disabled on exit");
  assert.match(lines.join("\n"), /meter_whsec_test/);
});

test("listen retries a failing forward 3 times then gives up", async () => {
  let attempts = 0;
  const { ctx } = stubContext(meterStub);
  await runListen(ctx, {
    forwardTo: "http://localhost:8787/hook",
    maxPolls: 1,
    sleep: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      return new Response(null, { status: 500 });
    },
  });
  assert.equal(attempts, 3);
});

test("listen without forwardTo observes only", async () => {
  const { ctx, lines } = stubContext(meterStub);
  await runListen(ctx, { maxPolls: 1, sleep: async () => {} });
  assert.match(lines.join("\n"), /usage\.committed/);
});
