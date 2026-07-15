import { test } from "node:test";
import assert from "node:assert/strict";
import { runCall } from "../src/commands/call.js";
import { stubContext } from "./helpers.js";

const service = { id: "svc", name: "Svc", creditName: "credits" };
const account = { balanceCredits: 995, status: "active", autoRechargeEnabled: false, rechargeThresholdCredits: 0, rechargeAmountCredits: 0, customerLocalId: "cli-test", customerName: "cli-test", serviceId: "svc", createdAt: 0, updatedAt: 0 };
const envelope = { service, customer: { localId: "cli-test", name: "cli-test" }, account };

test("direct mode posts tools/call with x-customer-id and prints the balance", async () => {
  const { ctx, lines } = stubContext(() => envelope);
  let captured: { headers: Headers; body: unknown } | null = null;
  await runCall(ctx, {
    tool: "echo",
    args: '{"text":"hi"}',
    url: "http://localhost:8787/mcp",
    fetchImpl: async (input, init) => {
      assert.equal(String(input), "http://localhost:8787/mcp");
      captured = { headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
      return Response.json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "hi" }] } });
    },
  });
  assert.equal(captured!.headers.get("x-customer-id"), "cli-test");
  const body = captured!.body as { method: string; params: { name: string; arguments: unknown } };
  assert.equal(body.method, "tools/call");
  assert.equal(body.params.name, "echo");
  assert.deepEqual(body.params.arguments, { text: "hi" });
  assert.match(lines.join("\n"), /995/);
});

test("direct mode parses SSE responses", async () => {
  const { ctx, lines } = stubContext(() => envelope);
  await runCall(ctx, {
    tool: "echo",
    url: "http://localhost:8787/mcp",
    fetchImpl: async () =>
      new Response(
        'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"sse-hi"}]}}\n\n',
        { status: 200, headers: { "content-type": "text/event-stream" } }
      ),
  });
  assert.match(lines.join("\n"), /sse-hi/);
});

test("rejects a non-integer --grant at the runner boundary", async () => {
  const { ctx } = stubContext(() => envelope);
  await assert.rejects(
    runCall(ctx, { tool: "echo", grantCredits: Number("abc") }),
    /--grant must be a positive integer/
  );
  await assert.rejects(
    runCall(ctx, { tool: "echo", grantCredits: 0 }),
    /--grant must be a positive integer/
  );
});

test("gateway mode refuses when the gateway is disabled", async () => {
  const { ctx } = stubContext((call) =>
    call.path.endsWith("/integration")
      ? { service, integration: { gatewayEnabled: false, toolPrices: {} }, gatewayUrl: "https://meter.example/g" }
      : envelope
  );
  await assert.rejects(runCall(ctx, { tool: "echo" }), /--url/);
});
