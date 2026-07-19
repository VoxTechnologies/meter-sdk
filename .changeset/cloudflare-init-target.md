---
"@meter-mcp/cli": minor
---

`meter init --target cloudflare` scaffolds a Cloudflare Workers MCP server: a
`fetch` handler over Web-standard Streamable HTTP with `wrangler.jsonc`, the
service API key kept in `.dev.vars` locally and `wrangler secret` for
production. The default target stays Node.js.
