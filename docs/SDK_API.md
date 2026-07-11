# Meter SDK API

The public SDK is split into three dual ESM/CommonJS packages for Node.js 20 and newer.

## `@meter/sdk`

### `MeterPublicApiClient`

Constructor options:

| Option | Required | Description |
| --- | --- | --- |
| `baseUrl` | yes | Absolute Meter HTTP(S) origin |
| `serviceId` | yes | Tenant-scoped Meter service ID |
| `serviceApiKey` | for protected methods | Server-side service API key |
| `fetchImpl` | no | Custom Fetch implementation |
| `defaultOrigin` | no | Default hosted-session return origin |
| `timeoutMs` | no | Request timeout, default 15 seconds |

Service and integration methods:

- `health`, `listServices`, `updateService`
- `listApiKeys`, `createApiKey`, `revokeApiKey`
- `getIntegration`, `updateIntegration`
- `listWebhookEndpoints`, `createWebhookEndpoint`, `disableWebhookEndpoint`, `testWebhooks`

Customer methods:

- `upsertCustomer`, `getCustomerCredits`, `getCustomerLedger`
- `setCustomerStatus`, `setAutoRecharge`, `createCreditAdjustment`
- `createTopUp`, `createPortalSession`

Usage methods:

- `authorize`, `commit`, `release`
- `meterToolCall` and its alias `withUsage`
- `listReservations`, `releaseExpiredReservations`, `usage`, `auditLogs`

Operator method:

- `createOperatorSession`

### `MeterOnboardingClient`

Uses a platform onboarding key to create a new service, its initial API key,
and optional gateway integration in one request. This client is intended for a
trusted Meter control plane, not provider frontend code.

### Webhook verification

`verifyMeterWebhookSignature` verifies the `x-meter-signature` HMAC against the
raw request body and enforces a timestamp tolerance. It accepts strings or
UTF-8 byte arrays and supports multiple `v1` signatures for key rotation.

### Errors

- `MeterPublicApiError` exposes `status`, `path`, parsed `body`, and optional `requestId`.
- `MeterTimeoutError` exposes `path` and `timeoutMs`.
- `MeterNetworkError` exposes `path` and `cause`.
- `MeterWebhookSignatureError` identifies malformed, stale, or invalid signatures.

Mutating requests are not automatically retried. Reuse the same idempotency or
request ID when retrying after an unknown network outcome.

## `@meter/mcp`

- `paidTool`: wraps an arbitrary async tool handler.
- `registerPaidTool`: registers a wrapped tool on an MCP-compatible server.
- `meterErrorToMcpResult`: converts recognized billing errors into structured MCP errors.

Billing values can be constants or async resolvers based on tool input and MCP
extra context. Supported attribution fields are customer, credits, provider,
product, request ID, and reservation TTL.

## `@meter/adapters`

- `createBuyerPortalHandler`
- `createBuyerPortalRedirectHandler`
- `createOperatorConsoleHandler`
- `createOperatorConsoleRedirectHandler`
- `toExpressHandler`

The provider must authenticate users and authorize operators before a session
is created. Hosted session origins are bound to the incoming request origin by
default and may be overridden explicitly.
