# @meter/sdk

Server-side TypeScript SDK for Meter prepaid credits, usage billing, hosted
buyer portals, service onboarding, and provider webhooks.

## Requirements

- Node.js 20 or newer
- A Meter service ID and server-side service API key

Never expose a service API key in browser code.

Both ESM `import` and CommonJS `require` are supported.

## Install

```bash
npm install @meter/sdk
```

## Meter a unit of work

```ts
import { MeterPublicApiClient } from "@meter/sdk";

const meter = new MeterPublicApiClient({
  baseUrl: process.env.METER_API_URL!,
  serviceId: process.env.METER_SERVICE_ID!,
  serviceApiKey: process.env.METER_SERVICE_API_KEY!,
  timeoutMs: 10_000,
});

const result = await meter.withUsage(
  {
    customerLocalId: "customer_123",
    tool: "knowledge_search",
    credits: 8,
    providerId: "creator:alice",
    productId: "vault_1",
  },
  () => searchKnowledge()
);
```

`withUsage` creates one request ID, reserves credits, runs the protected work,
commits usage on success, and releases the reservation when the work throws.
Supply your own `requestId` when retrying work across process boundaries.

## Track AI cost and gross margin

AI usage is attached only when protected work succeeds and Meter commits the
billing transaction. Resolve it from the provider response:

```ts
import { aiUsageFromOpenAI } from "@meter/adapters";

await meter.withUsage(usage, callOpenAI, {
  aiUsage: (response) => aiUsageFromOpenAI(response, {
    pricing: {
      inputPerMillionUsd: 2,
      outputPerMillionUsd: 8,
      cachedInputPerMillionUsd: 0.5,
      version: "provider-price-sheet-2026-07-11",
    },
  }),
});
```

Use `costUsd` when the AI provider or gateway returns actual billed cost.
Meter stores micro-USD integers and distinguishes reported, calculated, and
unpriced usage. Prices are supplied explicitly instead of silently pinned in
the SDK, so provider price changes remain auditable.

For integrations that cannot attach pricing on every request, configure a
service-scoped fallback with `upsertAiModelPrice`. Meter versions and retains
these prices and applies the latest effective version only to unpriced usage.

## Handle billing errors

```ts
import {
  isMeterPaymentRequiredPayload,
  MeterPublicApiError,
  MeterTimeoutError,
} from "@meter/sdk";

try {
  await meter.authorize({
    customerLocalId: "customer_123",
    tool: "knowledge_search",
    credits: 8,
    requestId: crypto.randomUUID(),
  });
} catch (error) {
  if (error instanceof MeterPublicApiError && isMeterPaymentRequiredPayload(error.body)) {
    return Response.redirect(error.body.topUpUrl, 303);
  }
  if (error instanceof MeterTimeoutError) {
    // The request outcome is unknown. Retry with the same request ID.
  }
  throw error;
}
```

## Hosted portal and operator console

```ts
const portal = await meter.createPortalSession("customer_123", {
  origin: "https://provider.example",
});

const consoleSession = await meter.createOperatorSession({
  externalSubject: "user_42",
  email: "owner@provider.example",
  role: "owner",
  origin: "https://provider.example",
});
```

Use [`@meter/adapters`](../adapters) to expose these as authenticated Fetch,
Next.js, Hono, or Express handlers.

## Gateway integration

Register an existing MCP server without changing each tool implementation:

```ts
const integration = await meter.updateIntegration({
  gatewayEnabled: true,
  upstreamUrl: "https://mcp.provider.example/mcp",
  upstreamAuthMode: "oauth_client_credentials",
  oauthTokenUrl: "https://auth.provider.example/oauth/token",
  oauthClientId: process.env.UPSTREAM_CLIENT_ID!,
  oauthClientSecret: process.env.UPSTREAM_CLIENT_SECRET!,
  oauthScopes: ["mcp:invoke"],
  customerAuthMode: "jwt",
  jwtIssuer: "https://auth.provider.example/",
  jwksUrl: "https://auth.provider.example/.well-known/jwks.json",
  jwtAudience: "meter-mcp",
  autoProvisionCustomers: true,
  defaultCredits: 1,
  toolPrices: { knowledge_search: 8, read_document: 3 },
});

console.log(integration.gatewayUrl);
```

## Verify provider webhooks

Read the raw request body before JSON parsing.

```ts
import { verifyMeterWebhookSignature } from "@meter/sdk";

const payload = await request.text();
await verifyMeterWebhookSignature({
  payload,
  signature: request.headers.get("x-meter-signature") ?? "",
  secret: process.env.METER_WEBHOOK_SECRET!,
});
const event = JSON.parse(payload);
```

The default timestamp tolerance is five minutes. Store the event ID and process
events idempotently because deliveries are retried.

## Error model

- `MeterPublicApiError`: Meter returned a non-2xx HTTP response.
- `MeterTimeoutError`: the configured timeout elapsed; the server outcome may be unknown.
- `MeterNetworkError`: no HTTP response was received.
- `MeterWebhookSignatureError`: webhook verification failed.

See the [SDK API reference](../../docs/SDK_API.md) and
[examples](../../examples/meter-sdk) for the complete integration surface.

## License

MIT
