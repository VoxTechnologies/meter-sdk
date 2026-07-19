# @meter-mcp/cli

Command-line interface for Meter prepaid credits and MCP usage billing.

## Install

```bash
npx @meter-mcp/cli
```

or install it globally:

```bash
npm i -g @meter-mcp/cli
```

## Quickstart

```bash
meter init my-server        # scaffold an embedded-metering MCP server + register a service
cd my-server
npm run dev
meter call echo --url http://localhost:8787/mcp --args '{"text":"hi"}'
meter events tail
```

`meter init` creates the project, registers a Meter service for it, and saves
a config profile named after the project (see [Configuration](#configuration)
below). The commands above are also printed at the end of `meter init`.

By default it scaffolds a Node.js server. Pass `--target cloudflare` to scaffold
a Cloudflare Workers version instead — a `fetch` handler over Web-standard
Streamable HTTP with a `wrangler.jsonc`, the service API key kept in `.dev.vars`
locally and `wrangler secret put` for production:

```bash
meter init my-server --target cloudflare
cd my-server
npm run dev                                  # wrangler dev on :8787
npx wrangler secret put METER_SERVICE_API_KEY && npm run deploy
```

## OAuth proxy (front an existing service)

`meter init` builds a new metered server. To put **OAuth 2.1** in front of an
MCP endpoint you already run — so clients whose remote-connector UX assumes
OAuth (claude.ai custom connectors) can connect with a Connect button instead
of custom buyer headers — scaffold a Cloudflare Workers proxy:

```bash
meter oauth-proxy my-svc-oauth \
  --backend-url https://my-svc.example.com \
  --mcp-path /api/mcp \
  --buyer-header x-meter-buyer-token \
  --service-name "My Service"
```

It creates no service and runs no onboarding — it pass-through-proxies the
JSON-RPC to your endpoint and injects the buyer identity from the OAuth grant
(re-implementing no tools). The grant stores a short-lived buyer token re-minted
on every token exchange, so revoking it halts spend within the hour. Your
backend must expose `POST /api/meter/customers` and
`POST /api/meter/customers/:id/token` (the generated project's README documents
the contract).

## Configuration

Credentials are stored per-profile in a config file at:

```
$XDG_CONFIG_HOME/meter/config.json   # defaults to ~/.config/meter/config.json
```

`meter login` writes to this file; `meter logout` removes a profile from it.
The file is created with `0600` permissions.

Connection settings are resolved in this order, highest priority first:

1. Command-line flags: `--base-url`, `--service-id`, `--api-key` (and
   `--profile` to select which saved profile to use as the fallback)
2. Environment variables: `METER_BASE_URL`, `METER_SERVICE_ID`, `METER_API_KEY`
3. The selected profile in the config file (`--profile <name>`, default
   `"default"`)

If none of these resolve a complete base URL / service ID / API key, every
command fails with a `CliError` (exit code 2) telling you to run `meter login`
or set the environment variables.

## Global options

| Option | Description |
| --- | --- |
| `--profile <name>` | Config profile to use (default: `"default"`) |
| `--json` | Emit machine-readable JSON instead of tables/text |
| `--base-url <url>` | Override the profile's base URL |
| `--service-id <id>` | Override the profile's service ID |
| `--api-key <key>` | Override the profile's API key |

## Commands

| Command | Description | Example |
| --- | --- | --- |
| `login` | Save credentials for a Meter service | `meter login` |
| `logout` | Remove the profile | `meter logout --profile prod` |
| `whoami` | Show the authenticated service | `meter whoami` |
| `init [name]` | Scaffold an embedded-metering MCP server and register its Meter service | `meter init my-server` |
| `services get` | Show the service profile | `meter services get` |
| `services update` | Update the service profile | `meter services update --name "Acme API" --credit-name "Acme Credits"` |
| `integration get` | Show the gateway integration | `meter integration get` |
| `integration update` | Update the gateway integration | `meter integration update --gateway-enabled true --upstream-url https://api.acme.dev/mcp` |
| `prices list` | List tool prices with their USD equivalent | `meter prices list` |
| `prices set <tool> <credits>` | Set the credit price for a tool | `meter prices set summarize 5` |
| `keys list` | List API keys | `meter keys list` |
| `keys create [name]` | Create an API key (prints the secret once) | `meter keys create ci-key` |
| `keys revoke <id>` | Revoke an API key | `meter keys revoke key_123` |
| `customers list` | List customer accounts | `meter customers list --limit 50` |
| `customers get <localId>` | Show a customer account | `meter customers get cust-42` |
| `customers grant <localId> <credits>` | Grant (or claw back, if negative) credits to a customer | `meter customers grant cust-42 100 --reason "support credit"` |
| `customers suspend <localId>` | Suspend a customer account | `meter customers suspend cust-42` |
| `customers resume <localId>` | Resume a suspended customer account | `meter customers resume cust-42` |
| `balance <localId>` | Show a customer's balance | `meter balance cust-42` |
| `ledger <localId>` | Show a customer's ledger | `meter ledger cust-42 --limit 20` |
| `usage` | Show usage rollups | `meter usage --by tool` |
| `events tail` | Follow new usage events | `meter events tail --tool summarize` |
| `webhooks list` | List webhook endpoints and recent deliveries | `meter webhooks list` |
| `webhooks create <url>` | Create a push webhook endpoint (prints the signing secret once) | `meter webhooks create https://acme.dev/webhooks/meter --events usage.recorded` |
| `webhooks delete <id>` | Disable a webhook endpoint | `meter webhooks delete wh_123` |
| `webhooks test` | Send a test event to all registered endpoints | `meter webhooks test` |
| `listen` | Stream provider webhooks to your terminal or a local URL | `meter listen --forward-to http://localhost:3000/webhooks/meter` |
| `call <tool>` | Call an MCP tool for testing (direct to `--url`, or via the gateway) | `meter call echo --url http://localhost:8787/mcp --args '{"text":"hi"}'` |

## `meter listen`

`meter listen` creates a temporary poll-mode webhook endpoint, prints its
signing secret once, and then polls for deliveries. Without `--forward-to` it
prints each event to the terminal; with `--forward-to <url>` it POSTs each
event's payload to that URL, signed the same way Meter signs push webhooks
(`x-meter-signature: t=<unix-seconds>,v1=<hmac-sha256-hex>` over the string
`"<timestamp>.<body>"`).

Verify that signature with `verifyMeterWebhookSignature` from
`@meter-mcp/sdk` in the receiving handler:

```ts
import { verifyMeterWebhookSignature, MeterWebhookSignatureError } from "@meter-mcp/sdk";

const body = await request.text(); // raw body, before JSON.parse
try {
  await verifyMeterWebhookSignature({
    payload: body,
    signature: request.headers.get("x-meter-signature") ?? "",
    secret: process.env.METER_WEBHOOK_SECRET!, // the signing secret meter listen printed
  });
} catch (error) {
  if (error instanceof MeterWebhookSignatureError) return new Response("invalid signature", { status: 400 });
  throw error;
}
```

The endpoint `meter listen` creates is disabled again when the process exits.
