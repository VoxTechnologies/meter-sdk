# @meter/adapters

Authenticated HTTP handlers for hosted Meter buyer portals and service
consoles. The core handlers use the standard Fetch `Request` and `Response`
APIs and work with Next.js, Hono, and Cloudflare-compatible runtimes. An
Express bridge is included.

## Install

```bash
npm install @meter/sdk @meter/adapters
```

## Next.js route

```ts
import { createBuyerPortalRedirectHandler } from "@meter/adapters";
import { meter } from "@/lib/meter";
import { auth } from "@/lib/auth";

export const GET = createBuyerPortalRedirectHandler({
  meter,
  authenticate: async () => {
    const session = await auth();
    return session?.user
      ? { id: session.user.id, email: session.user.email ?? undefined }
      : null;
  },
});
```

## Operator console

```ts
import { createOperatorConsoleRedirectHandler } from "@meter/adapters";

export const GET = createOperatorConsoleRedirectHandler({
  meter,
  authenticate: authenticateRequest,
  authorize: (user) => user.permissions.includes("billing:admin"),
  role: "billing_admin",
});
```

## Express

```ts
import { createBuyerPortalRedirectHandler, toExpressHandler } from "@meter/adapters";

app.get(
  "/billing",
  toExpressHandler(createBuyerPortalRedirectHandler({ meter, authenticate }))
);
```

Authentication and authorization remain the provider's responsibility. Never
accept a customer or operator identity directly from an untrusted request.

## AI provider usage

`aiUsageFromOpenAI` accepts Responses or Chat Completions usage shapes.
`aiUsageFromAnthropic` accepts Messages usage, including cache creation and
cache-read tokens. Pass explicit versioned pricing or actual `costUsd`, then
attach the result through `meter.withUsage(..., { aiUsage })`.

Both ESM `import` and CommonJS `require` are supported on Node.js 20 or newer.

## License

MIT
