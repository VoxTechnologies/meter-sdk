import assert from "node:assert/strict";
import test from "node:test";
import { MeterPublicApiError, type MeterPublicApiClient } from "@meter-mcp/sdk";
import {
  MeterMcpConfigurationError,
  meterErrorToMcpResult,
  paidTool,
  registerPaidTool,
} from "../src/index.js";

test("paidTool resolves billing attribution and delegates usage lifecycle", async () => {
  let usage: Record<string, unknown> | undefined;
  const meter = {
    withUsage: async (input: Record<string, unknown>, run: () => Promise<unknown>) => {
      usage = input;
      return run();
    },
  } as unknown as MeterPublicApiClient;
  const wrapped = paidTool(
    meter,
    "search",
    {
      customer: ({ extra }: { extra: { subject: string } }) => extra.subject,
      credits: ({ input }: { input: { cost: number } }) => input.cost,
      provider: "creator:one",
      product: ({ input }: { input: { product: string } }) => input.product,
      requestId: () => "req_1",
    },
    async (input: { cost: number; product: string }) => input.cost * 2
  );
  assert.equal(await wrapped({ cost: 4, product: "product_1" }, { subject: "buyer_1" }), 8);
  assert.deepEqual(usage, {
    customerLocalId: "buyer_1",
    tool: "search",
    credits: 4,
    providerId: "creator:one",
    productId: "product_1",
    requestId: "req_1",
    reservationTtlMs: undefined,
  });
});

test("payment errors become MCP-compatible error results", () => {
  const result = meterErrorToMcpResult(
    new MeterPublicApiError(402, "/authorize", {
      error: "payment_required",
      message: "Top up required.",
      topUpUrl: "https://meter.example/top-up",
      balanceCredits: 1,
      requiredCredits: 3,
    })
  );
  assert.equal(result?.isError, true);
  assert.equal(result?._meta.meter.error, "payment_required");
  assert.equal(result?._meta.meter.requiredCredits, 3);
});

test("registerPaidTool registers and translates only Meter billing errors", async () => {
  let registered: ((input: unknown, extra: unknown) => Promise<unknown>) | undefined;
  const server = {
    registerTool: (_name: string, _definition: unknown, handler: typeof registered) => {
      registered = handler;
      return "registered";
    },
  };
  const meter = {
    withUsage: async () => {
      throw new MeterPublicApiError(403, "/authorize", {
        error: "account_suspended",
        message: "Suspended.",
        customerId: "buyer_1",
      });
    },
  } as unknown as MeterPublicApiClient;
  const registration = registerPaidTool({
    server,
    meter,
    name: "search",
    definition: {},
    billing: { customer: () => "buyer_1", credits: 1 },
    handler: async () => ({ content: [] }),
  });
  assert.equal(registration, "registered");
  const result = await registered?.({}, {});
  assert.equal((result as { _meta: { meter: { error: string } } })._meta.meter.error, "account_suspended");
});

test("paidTool rejects invalid customer and credit resolvers before billing", async () => {
  const meter = {} as MeterPublicApiClient;
  const noCustomer = paidTool(
    meter,
    "search",
    { customer: () => "", credits: 1 },
    async () => "unused"
  );
  await assert.rejects(noCustomer({}, {}), MeterMcpConfigurationError);
  const invalidCredits = paidTool(
    meter,
    "search",
    { customer: () => "buyer", credits: 0 },
    async () => "unused"
  );
  await assert.rejects(invalidCredits({}, {}), /positive safe integer/);
});
