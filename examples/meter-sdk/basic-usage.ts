import { MeterPublicApiClient } from "@meter/sdk";

const meter = new MeterPublicApiClient({
  baseUrl: process.env.METER_API_URL!,
  serviceId: process.env.METER_SERVICE_ID!,
  serviceApiKey: process.env.METER_SERVICE_API_KEY!,
});

export async function generateAnswer(customerLocalId: string, prompt: string) {
  return meter.withUsage(
    {
      customerLocalId,
      tool: "generate_answer",
      credits: 25,
      requestId: crypto.randomUUID(),
    },
    async () => ({ answer: `Answer for: ${prompt}` })
  );
}
