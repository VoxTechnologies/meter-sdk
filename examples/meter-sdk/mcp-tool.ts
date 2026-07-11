import { registerPaidTool, type McpServerLike } from "@meter/mcp";
import { MeterPublicApiClient } from "@meter/sdk";

type ToolInput = { query: string; creatorId: string };
type ToolExtra = { auth: { subject: string } };
type ToolResult = { content: Array<{ type: string; text: string }> };
declare const server: McpServerLike<ToolInput, ToolExtra, ToolResult | import("@meter/mcp").McpPaymentRequiredResult>;

const meter = new MeterPublicApiClient({
  baseUrl: process.env.METER_API_URL!,
  serviceId: process.env.METER_SERVICE_ID!,
  serviceApiKey: process.env.METER_SERVICE_API_KEY!,
});

registerPaidTool({
  server,
  meter,
  name: "search",
  definition: { description: "Search provider content" },
  billing: {
    customer: ({ extra }) => extra.auth.subject,
    credits: 8,
    provider: ({ input }) => `creator:${input.creatorId}`,
  },
  handler: async (input) => ({
    content: [{ type: "text", text: `Results for ${input.query}` }],
  }),
});
