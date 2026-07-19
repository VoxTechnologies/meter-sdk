# @meter-mcp/cli

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
