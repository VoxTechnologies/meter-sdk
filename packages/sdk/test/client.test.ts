import assert from "node:assert/strict";
import test from "node:test";
import {
  MeterCommitFailedError,
  MeterNetworkError,
  MeterPublicApiClient,
  MeterPublicApiError,
  MeterTimeoutError,
} from "../src/index.js";

test("meterToolCall uses one generated request ID for authorize and commit", async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "service_1",
    serviceApiKey: "secret",
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      calls.push({ path: url.pathname, body: JSON.parse(String(init?.body)) });
      return Response.json({});
    },
  });

  const result = await client.meterToolCall(
    { customerLocalId: "customer_1", tool: "search", credits: 3 },
    () => "result"
  );

  assert.equal(result, "result");
  assert.deepEqual(calls.map((call) => call.path), [
    "/api/v1/meter/authorize",
    "/api/v1/meter/commit",
  ]);
  assert.equal(typeof calls[0]?.body.requestId, "string");
  assert.equal(calls[0]?.body.requestId, calls[1]?.body.requestId);
  assert.equal(calls[0]?.body.serviceId, "service_1");
});

test("meterToolCall attaches AI usage resolved from the protected result only to commit", async () => {
  const calls: Array<{ path: string; body: any }> = [];
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.test",
    serviceId: "service_1",
    serviceApiKey: "secret",
    fetchImpl: async (url, init) => {
      calls.push({ path: new URL(String(url)).pathname, body: JSON.parse(String(init?.body)) });
      return Response.json(calls.length === 1
        ? { authorized: true, service: {}, customer: {}, quote: {}, balanceCredits: 10 }
        : { committed: true, duplicate: false, service: {}, event: {}, balanceCredits: 9 });
    },
  });
  await client.meterToolCall(
    { customerLocalId: "buyer", tool: "answer", credits: 1 },
    async () => ({ usage: { input: 10, output: 4 } }),
    { aiUsage: (result) => ({ provider: "openai", model: "gpt-test", inputTokens: result.usage.input, outputTokens: result.usage.output, costUsd: 0.002 }) }
  );
  assert.equal(calls[0].body.aiUsage, undefined);
  assert.deepEqual(calls[1].body.aiUsage, {
    provider: "openai",
    model: "gpt-test",
    inputTokens: 10,
    outputTokens: 4,
    costUsd: 0.002,
  });
});

test("meterToolCall releases the generated reservation when protected work fails", async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "service_1",
    serviceApiKey: "secret",
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      calls.push({ path: url.pathname, body: JSON.parse(String(init?.body)) });
      return Response.json({});
    },
  });

  await assert.rejects(
    client.withUsage(
      { customerLocalId: "customer_1", tool: "search" },
      () => {
        throw new Error("upstream failed");
      }
    ),
    /upstream failed/
  );
  assert.deepEqual(calls.map((call) => call.path), [
    "/api/v1/meter/authorize",
    "/api/v1/meter/release",
  ]);
  assert.equal(calls[0]?.body.requestId, calls[1]?.body.requestId);
  assert.equal(calls[1]?.body.reason, "upstream failed");
});

test("meterToolCall retries a transient commit failure and returns the result", async () => {
  const calls: string[] = [];
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "service_1",
    serviceApiKey: "secret",
    fetchImpl: async (input) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === "/api/v1/meter/commit" && calls.filter((p) => p === path).length === 1) {
        return Response.json({ error: "internal" }, { status: 503 });
      }
      return Response.json({});
    },
  });

  const result = await client.meterToolCall(
    { customerLocalId: "customer_1", tool: "search", credits: 3 },
    () => "expensive result"
  );
  assert.equal(result, "expensive result");
  assert.deepEqual(calls, [
    "/api/v1/meter/authorize",
    "/api/v1/meter/commit",
    "/api/v1/meter/commit",
  ]);
});

test("meterToolCall throws MeterCommitFailedError carrying result and requestId when commit retries are exhausted", async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "service_1",
    serviceApiKey: "secret",
    fetchImpl: async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push({ path, body: JSON.parse(String(init?.body)) });
      if (path === "/api/v1/meter/commit") {
        return Response.json({ error: "internal" }, { status: 500 });
      }
      return Response.json({});
    },
  });

  await assert.rejects(
    client.meterToolCall(
      { customerLocalId: "customer_1", tool: "search", credits: 3 },
      () => "expensive result"
    ),
    (error) => {
      assert.ok(error instanceof MeterCommitFailedError);
      assert.equal(error.result, "expensive result");
      assert.equal(error.requestId, calls[0]?.body.requestId);
      assert.ok(error.cause instanceof MeterPublicApiError);
      return true;
    }
  );
  // 1 authorize + 3 commit attempts; the reservation must NOT be released, the
  // caller re-commits later with the preserved requestId.
  assert.deepEqual(calls.map((call) => call.path), [
    "/api/v1/meter/authorize",
    "/api/v1/meter/commit",
    "/api/v1/meter/commit",
    "/api/v1/meter/commit",
  ]);
});

test("meterToolCall does not retry commit on a 4xx response", async () => {
  const calls: string[] = [];
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "service_1",
    serviceApiKey: "secret",
    fetchImpl: async (input) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === "/api/v1/meter/commit") {
        return Response.json({ error: "bad_request" }, { status: 400 });
      }
      return Response.json({});
    },
  });

  await assert.rejects(
    client.meterToolCall({ customerLocalId: "customer_1", tool: "search" }, () => "ok"),
    MeterCommitFailedError
  );
  assert.deepEqual(calls, ["/api/v1/meter/authorize", "/api/v1/meter/commit"]);
});

test("HTTP errors expose status, response body, path, and request ID", async () => {
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "service_1",
    serviceApiKey: "secret",
    fetchImpl: async () =>
      Response.json(
        { error: "payment_required" },
        { status: 402, headers: { "x-request-id": "req_123" } }
      ),
  });

  await assert.rejects(client.getCustomerCredits("customer_1"), (error) => {
    assert.ok(error instanceof MeterPublicApiError);
    assert.equal(error.status, 402);
    assert.equal(error.requestId, "req_123");
    assert.equal(error.path, "/api/v1/services/service_1/customers/customer_1/credits");
    assert.deepEqual(error.body, { error: "payment_required" });
    return true;
  });
});

test("network and timeout failures use stable SDK error classes", async () => {
  const networkClient = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "service_1",
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  await assert.rejects(networkClient.listServices(), MeterNetworkError);

  const timeoutClient = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "service_1",
    timeoutMs: 5,
    fetchImpl: async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  });
  await assert.rejects(timeoutClient.listServices(), (error) => {
    assert.ok(error instanceof MeterTimeoutError);
    assert.equal(error.timeoutMs, 5);
    return true;
  });
});

test("base URL, path values, query, auth, and default origin are normalized", async () => {
  let requestUrl = "";
  let authorization = "";
  let body: Record<string, unknown> = {};
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example/",
    serviceId: "service/one",
    serviceApiKey: "service-secret",
    defaultOrigin: "https://provider.example",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      body = JSON.parse(String(init?.body));
      return Response.json({});
    },
  });
  await client.createPortalSession("buyer/email@example.com");
  assert.equal(
    requestUrl,
    "https://meter.example/api/v1/services/service%2Fone/customers/buyer%2Femail%40example.com/portal-session"
  );
  assert.equal(authorization, "Bearer service-secret");
  assert.equal(body.origin, "https://provider.example");
});

test("configured tenant cannot be overridden by untyped runtime input", async () => {
  let body: Record<string, unknown> = {};
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "trusted_service",
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({});
    },
  });
  await client.authorize({
    customerLocalId: "buyer",
    tool: "search",
    serviceId: "other_service",
  } as never);
  assert.equal(body.serviceId, "trusted_service");
});

test("pollWebhookDeliveries long-polls the pending route", async () => {
  let captured: URL | null = null;
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "svc",
    serviceApiKey: "secret",
    fetchImpl: async (input) => {
      captured = new URL(String(input));
      return Response.json({ deliveries: [{ id: "wd_1", payload: { type: "test.event" } }] });
    },
  });
  const result = await client.pollWebhookDeliveries("wh_1", { wait: 25, limit: 10 });
  assert.equal(result.deliveries[0]?.id, "wd_1");
  assert.equal(
    captured?.pathname,
    "/api/v1/services/svc/webhook-endpoints/wh_1/deliveries/pending"
  );
  assert.equal(captured?.searchParams.get("wait"), "25");
  assert.equal(captured?.searchParams.get("limit"), "10");
});

test("ackWebhookDeliveries posts ids", async () => {
  let capturedBody: Record<string, unknown> = {};
  let capturedPath = "";
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "svc",
    serviceApiKey: "secret",
    fetchImpl: async (input, init) => {
      capturedPath = new URL(String(input)).pathname;
      capturedBody = JSON.parse(String(init?.body));
      return Response.json({ acknowledged: 2 });
    },
  });
  const result = await client.ackWebhookDeliveries("wh_1", ["wd_1", "wd_2"]);
  assert.equal(result.acknowledged, 2);
  assert.equal(capturedPath, "/api/v1/services/svc/webhook-endpoints/wh_1/deliveries/ack");
  assert.deepEqual(capturedBody.ids, ["wd_1", "wd_2"]);
});

test("createWebhookEndpoint accepts poll mode without url", async () => {
  let capturedBody: Record<string, unknown> = {};
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "svc",
    serviceApiKey: "secret",
    fetchImpl: async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return Response.json({ endpoint: { id: "wh_1", mode: "poll" }, signingSecret: "meter_whsec_x" });
    },
  });
  const created = await client.createWebhookEndpoint({ mode: "poll", events: ["*"] });
  assert.equal(created.endpoint.mode, "poll");
  assert.equal(capturedBody.mode, "poll");
  assert.ok(!("url" in capturedBody));
});

test("listCustomers hits the customers list route", async () => {
  let captured: URL | null = null;
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "svc",
    serviceApiKey: "secret",
    fetchImpl: async (input) => {
      captured = new URL(String(input));
      return Response.json({ customers: [{ customerLocalId: "c1", balanceCredits: 5 }] });
    },
  });
  const result = await client.listCustomers(50);
  assert.equal(result.customers[0]?.customerLocalId, "c1");
  assert.equal(captured?.pathname, "/api/v1/services/svc/customers");
  assert.equal(captured?.searchParams.get("limit"), "50");
});
