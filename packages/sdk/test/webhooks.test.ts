import assert from "node:assert/strict";
import test from "node:test";
import {
  MeterWebhookSignatureError,
  verifyMeterWebhookSignature,
} from "../src/index.js";

async function signature(secret: string, timestamp: number, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

test("verifies a signed raw webhook payload", async () => {
  const payload = JSON.stringify({ id: "evt_1", type: "usage.committed" });
  const timestamp = 1_800_000_000;
  const digest = await signature("whsec_test", timestamp, payload);
  const parsed = await verifyMeterWebhookSignature({
    payload,
    signature: `t=${timestamp},v1=old,v1=${digest}`,
    secret: "whsec_test",
    now: timestamp * 1000,
  });
  assert.equal(parsed.timestamp, timestamp);
  assert.equal(parsed.signatures.length, 2);
});

test("rejects tampered, malformed, and stale webhook signatures", async () => {
  const timestamp = 1_800_000_000;
  const digest = await signature("whsec_test", timestamp, "original");
  await assert.rejects(
    verifyMeterWebhookSignature({
      payload: "tampered",
      signature: `t=${timestamp},v1=${digest}`,
      secret: "whsec_test",
      now: timestamp * 1000,
    }),
    MeterWebhookSignatureError
  );
  await assert.rejects(
    verifyMeterWebhookSignature({
      payload: "original",
      signature: `t=${timestamp},v1=${digest}`,
      secret: "whsec_test",
      now: (timestamp + 301) * 1000,
    }),
    /outside tolerance/
  );
  await assert.rejects(
    verifyMeterWebhookSignature({
      payload: "original",
      signature: "invalid",
      secret: "whsec_test",
      now: timestamp * 1000,
    }),
    /Invalid x-meter-signature/
  );
});
