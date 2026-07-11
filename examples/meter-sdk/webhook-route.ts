import { verifyMeterWebhookSignature } from "@meter/sdk";

export async function POST(request: Request): Promise<Response> {
  const payload = await request.text();
  await verifyMeterWebhookSignature({
    payload,
    signature: request.headers.get("x-meter-signature") ?? "",
    secret: process.env.METER_WEBHOOK_SECRET!,
  });
  const event = JSON.parse(payload) as { id: string; type: string };
  await processEventIdempotently(event);
  return Response.json({ received: true });
}

async function processEventIdempotently(event: { id: string; type: string }) {
  console.log(event.id, event.type);
}
