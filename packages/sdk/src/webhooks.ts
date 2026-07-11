export type MeterWebhookSignature = {
  timestamp: number;
  signatures: string[];
};

export class MeterWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeterWebhookSignatureError";
  }
}

function parseSignature(header: string): MeterWebhookSignature {
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  if (!Number.isInteger(timestamp) || !signatures.length) {
    throw new MeterWebhookSignatureError("Invalid x-meter-signature header");
  }
  return { timestamp: timestamp!, signatures };
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyMeterWebhookSignature(input: {
  payload: string | Uint8Array;
  signature: string;
  secret: string;
  toleranceSeconds?: number;
  now?: number;
}): Promise<MeterWebhookSignature> {
  if (!input.secret) throw new MeterWebhookSignatureError("Webhook signing secret is required");
  const parsed = parseSignature(input.signature);
  const now = input.now ?? Date.now();
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) {
    throw new MeterWebhookSignatureError("toleranceSeconds must be a non-negative number");
  }
  if (Math.abs(Math.floor(now / 1000) - parsed.timestamp) > toleranceSeconds) {
    throw new MeterWebhookSignatureError("Webhook signature timestamp is outside tolerance");
  }
  const payload =
    typeof input.payload === "string"
      ? input.payload
      : new TextDecoder().decode(input.payload);
  const expected = await hmacHex(input.secret, `${parsed.timestamp}.${payload}`);
  if (!parsed.signatures.some((signature) => constantTimeEqual(signature, expected))) {
    throw new MeterWebhookSignatureError("Webhook signature verification failed");
  }
  return parsed;
}
