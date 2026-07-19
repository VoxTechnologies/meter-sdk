---
"@meter-mcp/cli": patch
---

Fix the `oauth-proxy` template re-minting the buyer token only when a module
global was warm. The backend config now travels in the OAuth grant props, so
`tokenExchangeCallback` re-mints from props alone — even on a cold isolate whose
first request is the token refresh — instead of skipping the re-mint and letting
the short buyer token age out into a non-self-healing 401 (worst for the idle,
low-traffic workers this command scaffolds).
