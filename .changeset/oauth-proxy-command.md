---
"@meter-mcp/cli": minor
---

`meter oauth-proxy` scaffolds a Cloudflare Workers OAuth 2.1 proxy that fronts
an existing Meter-backed MCP endpoint: a pass-through that injects the buyer
identity from the OAuth grant (re-implementing no tools), with account-less
buyer provisioning on the consent page and short-lived tokens re-minted on
every token exchange so revoking the grant halts spend within the hour. The
target service is configured via Wrangler vars (backend URL, MCP path,
buyer-token header, service name).
