# Meter SDK

Official public integration libraries for [Meter](https://meter-mcp.vercel.app),
an MCP prepaid-credit and usage-billing platform.

This repository intentionally contains only public client libraries, protocol
types, adapters, examples, and the public OpenAPI contract. Meter's billing
engine, ledger, Stripe and payout processing, MCP Gateway, dashboards, database
schema, and operational infrastructure are maintained separately and are not
part of this repository.

## Packages

| Package | Purpose |
| --- | --- |
| `@meter-mcp/sdk` | Typed server-side API client and webhook verification |
| `@meter-mcp/mcp` | `paidTool` and `registerPaidTool` MCP billing wrappers |
| `@meter-mcp/adapters` | Fetch, Next.js, Hono, and Express hosted-session adapters |
| `@meter-mcp/cli` | `meter` command-line interface for services, keys, customers, usage, and webhooks |

```bash
npm install @meter-mcp/sdk
npx @meter-mcp/cli init my-server
```

All packages support ESM and CommonJS on Node.js 20, 22, and 24. Service API
keys must only be used in trusted server-side code.

## Development

```bash
npm install
npm run verify
```

The verification gate builds and tests every package, checks ESM and CommonJS
type resolution, installs the exact npm tarballs into clean consumers, compiles
the examples, validates the OpenAPI document, scans dependencies, and lints
package metadata.

See the [API reference](./docs/SDK_API.md), [CLI reference](./packages/cli/README.md),
[examples](./examples/meter-sdk), and [release runbook](./docs/SDK_RELEASE.md).

## Security

Report vulnerabilities according to [SECURITY.md](./SECURITY.md). Do not place
service keys or webhook secrets in browser bundles, examples, issues, or logs.

## License and trademarks

Source code is available under the [MIT License](./LICENSE). The license does
not grant rights to use Meter names or marks; see [TRADEMARKS.md](./TRADEMARKS.md).
