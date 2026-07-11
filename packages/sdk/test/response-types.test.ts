import assert from "node:assert/strict";
import test from "node:test";
import type {
  MeterAuthorizeResponse,
  MeterCommitResponse,
  MeterCreditAccount,
  MeterCustomer,
  MeterPublicApiClient,
  MeterReleaseResponse,
  MeterService,
  MeterUsageEvent,
} from "../src/index.js";

// These are type-level regression locks for the honest response shapes: each
// fixture uses `satisfies`, so reintroducing a lying type (required apiKey,
// quote with customerLocalId, non-nullable reservation) fails typecheck/build,
// not just a runtime assertion.

const service: MeterService = {
  id: "service_1",
  slug: "service-one",
  name: "Service One",
  creditName: "credit",
  brandColor: "#000000",
};

const customer: MeterCustomer = { localId: "buyer_1", name: "Buyer One" };

const account: MeterCreditAccount = {
  serviceId: "service_1",
  customerLocalId: "buyer_1",
  customerName: "Buyer One",
  balanceCredits: 10,
  autoRechargeEnabled: false,
  rechargeThresholdCredits: 0,
  rechargeAmountCredits: 0,
  status: "active",
  createdAt: 1,
  updatedAt: 1,
};

const event: MeterUsageEvent = {
  id: "event_1",
  ts: 1,
  serviceId: "service_1",
  customerLocalId: "buyer_1",
  customerName: "Buyer One",
  tool: "search",
  credits: 1,
  provider: "self",
};

test("upsertCustomer result compiles with apiKey absent", () => {
  const upserted = { service, customer, account } satisfies Awaited<
    ReturnType<MeterPublicApiClient["upsertCustomer"]>
  >;
  assert.equal(upserted.apiKey, undefined);
});

test("authorize quote has no customerLocalId and allows zero credits", () => {
  // Compile-time proof the key is absent: this annotation resolves to `true`
  // only while `customerLocalId` is not part of the quote shape.
  const quoteOmitsCustomerLocalId: "customerLocalId" extends keyof MeterAuthorizeResponse["quote"]
    ? never
    : true = true;
  assert.equal(quoteOmitsCustomerLocalId, true);

  const authorized = {
    authorized: true,
    service,
    customer: { serviceId: "service_1", localId: "buyer_1", name: "Buyer One" },
    quote: { tool: "search", provider: "self", credits: 0 },
    balanceCredits: 10,
    reservation: null,
  } satisfies MeterAuthorizeResponse;
  assert.equal(authorized.quote.credits, 0);
});

test("authorize, commit, and release responses accept reservation: null", () => {
  const committed = {
    committed: true,
    duplicate: false,
    service,
    event,
    balanceCredits: 9,
    reservation: null,
  } satisfies MeterCommitResponse;

  const released = {
    released: false,
    service,
    customer: { serviceId: "service_1", localId: "buyer_1", name: "Buyer One" },
    reservation: null,
    account,
    balanceCredits: 10,
  } satisfies MeterReleaseResponse;

  assert.equal(committed.reservation, null);
  assert.equal(released.reservation, null);
});
