import { verifyMeterWebhookSignature } from "@meter-mcp/sdk";

export async function POST(request: Request): Promise<Response> {
  const payload = await request.text();
  // A bad/forged signature must be a 400, not an unhandled 500: verifyMeterWebhookSignature
  // throws on mismatch, so catch it and reject explicitly before trusting the body.
  try {
    await verifyMeterWebhookSignature({
      payload,
      signature: request.headers.get("x-meter-signature") ?? "",
      secret: process.env.METER_WEBHOOK_SECRET!,
    });
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }
  const event = JSON.parse(payload) as { id: string; type: string };
  await processEventIdempotently(event);
  return Response.json({ received: true });
}

async function processEventIdempotently(event: { id: string; type: string }) {
  console.log(event.id, event.type);
}
