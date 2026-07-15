import { test } from "node:test";
import assert from "node:assert/strict";
import { runCustomersGrant, runCustomersList, runKeysCreate } from "../src/commands/customers.js";
import { stubContext } from "./helpers.js";

const service = { id: "svc", name: "Svc", creditName: "credits" };

test("customers list renders a table of accounts", async () => {
  const { ctx, lines, calls } = stubContext(() => ({
    service,
    customers: [
      { customerLocalId: "alice", customerName: "Alice", balanceCredits: 120, status: "active" },
    ],
  }));
  await runCustomersList(ctx, 50);
  assert.equal(calls[0]?.path, "/api/v1/services/svc/customers");
  assert.equal(calls[0]?.query.get("limit"), "50");
  assert.match(lines.join("\n"), /alice\s+Alice\s+120\s+active/);
});

test("grant posts a credit adjustment with an idempotency key", async () => {
  const { ctx, calls } = stubContext(() => ({
    service,
    customer: { localId: "alice", name: "Alice" },
    account: { balanceCredits: 220 },
    adjustment: { id: "adj_1" },
  }));
  await runCustomersGrant(ctx, "alice", 100, { reason: "goodwill" });
  const body = calls[0]?.body as Record<string, unknown>;
  assert.equal(calls[0]?.path, "/api/v1/services/svc/customers/alice/credit-adjustments");
  assert.equal(body.creditsDelta, 100);
  assert.equal(body.note, "goodwill");
  assert.equal(typeof body.idempotencyKey, "string");
});

test("keys create surfaces the one-time secret", async () => {
  const { ctx, lines } = stubContext(() => ({
    service,
    apiKey: { id: "key_1", name: "ci", last4: "abcd", secret: "sk_new_secret" },
  }));
  await runKeysCreate(ctx, "ci");
  assert.match(lines.join("\n"), /sk_new_secret/);
  assert.match(lines.join("\n"), /shown only once/i);
});
