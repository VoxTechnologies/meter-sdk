# @meter-mcp/cli

## 0.4.1

### Patch Changes

- 85b0ebe: Fix the `oauth-proxy` template re-minting the buyer token only when a module
  global was warm. The backend config now travels in the OAuth grant props, so
  `tokenExchangeCallback` re-mints from props alone — even on a cold isolate whose
  first request is the token refresh — instead of skipping the re-mint and letting
  the short buyer token age out into a non-self-healing 401 (worst for the idle,
  low-traffic workers this command scaffolds).
  - @meter-mcp/sdk@0.4.1

## 0.4.0

### Minor Changes

- 3b7c7a1: `meter oauth-proxy` scaffolds a Cloudflare Workers OAuth 2.1 proxy that fronts
  an existing Meter-backed MCP endpoint: a pass-through that injects the buyer
  identity from the OAuth grant (re-implementing no tools), with account-less
  buyer provisioning on the consent page and short-lived tokens re-minted on
  every token exchange so revoking the grant halts spend within the hour. The
  target service is configured via Wrangler vars (backend URL, MCP path,
  buyer-token header, service name).

### Patch Changes

- @meter-mcp/sdk@0.4.0

## 0.3.0

### Minor Changes

- 2cdd3f8: `meter init --target cloudflare` scaffolds a Cloudflare Workers MCP server: a
  `fetch` handler over Web-standard Streamable HTTP with `wrangler.jsonc`, the
  service API key kept in `.dev.vars` locally and `wrangler secret` for
  production. The default target stays Node.js.

### Patch Changes

- @meter-mcp/sdk@0.3.0

## 0.2.0

### Minor Changes

- fdc6358: Add @meter-mcp/cli and SDK poll/ack/listCustomers support

### Patch Changes

- Updated dependencies [438038d]
- Updated dependencies [fdc6358]
  - @meter-mcp/sdk@0.2.0

## 0.1.1

Initial scaffold of the Meter command-line interface.
