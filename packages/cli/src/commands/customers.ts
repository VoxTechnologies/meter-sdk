import { randomUUID } from "node:crypto";
import type { CliContext } from "../context.js";
import { CliError } from "../config.js";
import { emit, formatTs, renderTable } from "../output.js";

export async function runKeysList(ctx: CliContext): Promise<void> {
  const { apiKeys } = await ctx.client.listApiKeys();
  const rows = apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    last4: `...${key.last4}`,
    created: formatTs(key.createdAt),
    revoked: key.revokedAt ? formatTs(key.revokedAt) : "",
  }));
  emit(ctx, renderTable(rows, ["id", "name", "last4", "created", "revoked"]).split("\n"), { apiKeys });
}

export async function runKeysCreate(ctx: CliContext, name?: string): Promise<void> {
  const { apiKey } = await ctx.client.createApiKey(name);
  emit(
    ctx,
    [
      `Created key ${apiKey.id} (${apiKey.name}).`,
      `Secret (shown only once): ${apiKey.secret}`,
    ],
    { apiKey }
  );
}

export async function runKeysRevoke(ctx: CliContext, keyId: string): Promise<void> {
  await ctx.client.revokeApiKey(keyId);
  emit(ctx, [`Revoked key ${keyId}.`], { revoked: keyId });
}

export async function runCustomersList(ctx: CliContext, limit?: number): Promise<void> {
  const { customers } = await ctx.client.listCustomers(limit);
  const rows = customers.map((account) => ({
    localId: account.customerLocalId,
    name: account.customerName,
    balance: account.balanceCredits,
    status: account.status,
  }));
  emit(
    ctx,
    rows.length
      ? renderTable(rows, ["localId", "name", "balance", "status"]).split("\n")
      : ["No customers yet."],
    { customers }
  );
}

export async function runCustomersGet(ctx: CliContext, localId: string): Promise<void> {
  const envelope = await ctx.client.getCustomerCredits(localId);
  const { customer, account } = envelope;
  emit(
    ctx,
    [
      `customer  ${customer.localId} (${customer.name})`,
      `balance   ${account.balanceCredits} credits`,
      `status    ${account.status}`,
      `recharge  ${account.autoRechargeEnabled ? `at ${account.rechargeThresholdCredits} -> +${account.rechargeAmountCredits}` : "off"}`,
    ],
    envelope
  );
}

export async function runCustomersGrant(
  ctx: CliContext,
  localId: string,
  credits: number,
  opts: { reason?: string; idempotencyKey?: string }
): Promise<void> {
  if (!Number.isSafeInteger(credits) || credits === 0) {
    throw new CliError("credits must be a non-zero integer (negative claws back)");
  }
  const result = await ctx.client.createCreditAdjustment(localId, {
    creditsDelta: credits,
    idempotencyKey: opts.idempotencyKey ?? randomUUID(),
    note: opts.reason,
  });
  emit(
    ctx,
    [`Adjusted ${localId} by ${credits}; balance is now ${result.account.balanceCredits}.`],
    result
  );
}

export async function runCustomersSetStatus(
  ctx: CliContext,
  localId: string,
  status: "active" | "suspended"
): Promise<void> {
  const result = await ctx.client.setCustomerStatus(localId, status);
  emit(ctx, [`${localId} is now ${result.account.status}.`], result);
}

export async function runBalance(ctx: CliContext, localId: string): Promise<void> {
  await runCustomersGet(ctx, localId);
}

export async function runLedger(ctx: CliContext, localId: string, limit?: number): Promise<void> {
  const result = await ctx.client.getCustomerLedger(localId, limit);
  const rows = result.ledger.map((entry) => ({
    ts: formatTs(entry.ts),
    type: entry.type,
    delta: entry.creditsDelta > 0 ? `+${entry.creditsDelta}` : String(entry.creditsDelta),
    balance: entry.balanceAfter,
    note: entry.note ?? "",
  }));
  emit(
    ctx,
    rows.length
      ? renderTable(rows, ["ts", "type", "delta", "balance", "note"]).split("\n")
      : ["No ledger entries."],
    { ledger: result.ledger }
  );
}
