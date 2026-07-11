# @meter/mcp

Drop-in prepaid billing wrappers for Model Context Protocol tools.

## Install

```bash
npm install @meter/sdk @meter/mcp
```

## Register a paid tool

```ts
import { MeterPublicApiClient } from "@meter/sdk";
import { registerPaidTool } from "@meter/mcp";

const meter = new MeterPublicApiClient({
  baseUrl: process.env.METER_API_URL!,
  serviceId: process.env.METER_SERVICE_ID!,
  serviceApiKey: process.env.METER_SERVICE_API_KEY!,
});

registerPaidTool({
  server,
  meter,
  name: "knowledge_search",
  definition: { description: "Search knowledge", inputSchema },
  billing: {
    customer: ({ extra }) => extra.auth.subject,
    credits: 8,
    provider: ({ input }) => `creator:${input.creatorId}`,
    product: ({ input }) => input.productId,
  },
  handler: searchKnowledge,
});
```

The wrapper reserves credits before invoking the tool, commits after success,
and releases on failure. Payment-required and suspended-account responses are
returned as MCP tool errors with structured billing details in `_meta.meter`.
Unexpected errors continue to throw.

Use `paidTool` when your MCP framework has a different registration API, and
use `meterErrorToMcpResult` when you need to translate errors yourself.

Both ESM `import` and CommonJS `require` are supported on Node.js 20 or newer.

## License

MIT
