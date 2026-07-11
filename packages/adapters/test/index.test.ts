import assert from "node:assert/strict";
import test from "node:test";
import type { MeterPublicApiClient } from "@meter/sdk";
import {
  aiUsageFromAnthropic,
  aiUsageFromOpenAI,
  createBuyerPortalHandler,
  createBuyerPortalRedirectHandler,
  createOperatorConsoleHandler,
  toExpressHandler,
} from "../src/index.js";

test("normalizes OpenAI and Anthropic usage without double-counting cached tokens", () => {
  const openai = aiUsageFromOpenAI({
    id: "resp_1",
    model: "gpt-test",
    usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 40 }, output_tokens_details: { reasoning_tokens: 5 } },
  }, { pricing: { inputPerMillionUsd: 1, cachedInputPerMillionUsd: 0.1, outputPerMillionUsd: 2 } });
  assert.equal(openai.inputTokens, 60);
  assert.equal(openai.cachedInputTokens, 40);
  assert.equal(openai.totalTokens, 125);
  const anthropic = aiUsageFromAnthropic({
    id: "msg_1",
    model: "claude-test",
    usage: { input_tokens: 70, cache_creation_input_tokens: 10, cache_read_input_tokens: 20, output_tokens: 5 },
  });
  assert.equal(anthropic.inputTokens, 80);
  assert.equal(anthropic.cachedInputTokens, 20);
  assert.equal(anthropic.totalTokens, 105);
});

test("buyer handler authenticates and creates an origin-bound session", async () => {
  let received: unknown;
  const meter = {
    createPortalSession: async (customerLocalId: string, input: unknown) => {
      received = { customerLocalId, input };
      return { session: { token: "token", url: "https://meter.example/portal" } };
    },
  } as unknown as MeterPublicApiClient;
  const handler = createBuyerPortalHandler({
    meter,
    authenticate: async () => ({ id: "buyer_1" }),
  });
  const response = await handler(new Request("https://provider.example/api/meter"));
  assert.equal(response.status, 200);
  assert.deepEqual(received, {
    customerLocalId: "buyer_1",
    input: { ttlSeconds: undefined, origin: "https://provider.example" },
  });
});

test("buyer redirect and operator authorization use explicit HTTP outcomes", async () => {
  const redirect = createBuyerPortalRedirectHandler({
    meter: {
      createPortalSession: async () => ({ session: { url: "https://meter.example/portal" } }),
    } as unknown as MeterPublicApiClient,
    authenticate: async () => ({ id: "buyer_1" }),
  });
  const redirectResponse = await redirect(new Request("https://provider.example/meter"));
  assert.equal(redirectResponse.status, 303);
  assert.equal(redirectResponse.headers.get("location"), "https://meter.example/portal");

  const forbidden = createOperatorConsoleHandler({
    meter: {} as MeterPublicApiClient,
    authenticate: async () => ({ id: "operator_1", email: "operator@example.com" }),
    authorize: async () => false,
  });
  assert.equal((await forbidden(new Request("https://provider.example/console"))).status, 403);
});

test("toExpressHandler forwards status, headers, and response body", async () => {
  const express = toExpressHandler(async () =>
    Response.json({ ok: true }, { status: 201, headers: { "x-meter": "yes" } })
  );
  let status = 0;
  let body = "";
  const headers = new Map<string, string>();
  const response = {
    status(code: number) {
      status = code;
      return response;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    send(value: string) {
      body = value;
    },
  };
  await express(
    {
      protocol: "https",
      originalUrl: "/meter",
      get: () => "provider.example",
      headers: {},
      method: "GET",
    },
    response
  );
  assert.equal(status, 201);
  assert.equal(headers.get("x-meter"), "yes");
  assert.deepEqual(JSON.parse(body), { ok: true });
});
