import { MeterPublicApiClient } from "@meter-mcp/sdk";
import { aiUsageFromOpenAI } from "@meter-mcp/adapters";

declare const openai: { responses: { create(input: unknown): Promise<any> } };

const meter = new MeterPublicApiClient({
  baseUrl: process.env.METER_API_URL!,
  serviceId: process.env.METER_SERVICE_ID!,
  serviceApiKey: process.env.METER_SERVICE_API_KEY!,
});

const result = await meter.withUsage(
  { customerLocalId: "buyer_123", tool: "knowledge_answer", credits: 25 },
  async () => openai.responses.create({ model: "your-model", input: "Answer this" }),
  {
    aiUsage: (response) => aiUsageFromOpenAI(response, {
      pricing: {
        inputPerMillionUsd: Number(process.env.MODEL_INPUT_USD_PER_MILLION),
        outputPerMillionUsd: Number(process.env.MODEL_OUTPUT_USD_PER_MILLION),
        cachedInputPerMillionUsd: Number(process.env.MODEL_CACHED_INPUT_USD_PER_MILLION),
        version: process.env.MODEL_PRICE_VERSION,
      },
    }),
  }
);

console.log(result.output_text);
