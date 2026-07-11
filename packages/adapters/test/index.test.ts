import assert from "node:assert/strict";
import test from "node:test";
import type { MeterPublicApiClient } from "@meter/sdk";
import {
  createBuyerPortalHandler,
  createBuyerPortalRedirectHandler,
  createOperatorConsoleHandler,
  toExpressHandler,
} from "../src/index.js";

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
