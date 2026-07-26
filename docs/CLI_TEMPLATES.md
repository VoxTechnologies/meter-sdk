# CLI scaffolding templates

Maintainer notes for `packages/cli/templates/`, the source trees `meter init` and
`meter oauth-proxy` copy into a user's new project. For the user-facing command
reference see the [CLI README](../packages/cli/README.md).

## Layout

`packages/cli/templates/` ships inside the published tarball (it is listed in the
CLI's `files` array) and holds three independent trees:

| Tree | Scaffolded by | Runtime |
| --- | --- | --- |
| `src/` + root `*.tmpl` | `meter init` (default) | Node.js |
| `cloudflare/` | `meter init --target cloudflare` | Workers |
| `cloudflare-oauth/` | `meter oauth-proxy` | Workers |

## `oauth-proxy` is not an `init` variant

`meter init` creates a service and runs onboarding. `meter oauth-proxy` does
neither: it scaffolds a generic Workers OAuth front for an MCP endpoint the
provider already runs, so OAuth-only MCP clients can connect to it.

The generated Worker source is target-agnostic and is copied verbatim. The target
is supplied at deploy time through Wrangler vars, which the CLI writes into
`wrangler.jsonc`:

```text
BACKEND_BASE_URL   the existing service's origin
MCP_PATH           the MCP route on that origin (default /api/mcp)
BUYER_HEADER       header carrying the buyer token (default x-meter-buyer-token)
SERVICE_NAME       display name on the consent screen
```

`test/oauth-proxy.test.ts` asserts the target never leaks into the copied source,
which is what keeps that separation honest.

## Rendering

Scaffolding is `__TOKEN__` string replacement over the `.tmpl` files, not a
template engine. Files outside `*.tmpl` are copied byte-for-byte.

Both `runInit` and `runOAuthProxy` locate the templates with a `packageRoot()`
walk-up to the nearest `package.json`. That is what makes the path resolve
identically under `tsx`, under the tsup-bundled `dist/cli.js`, and from an
installed `node_modules/@meter-mcp/cli`. Do not replace it with a path relative
to `import.meta.url`.

## What the gate does and does not cover

`npm run typecheck:templates` compiles the Node and `cloudflare/` trees through
`packages/cli/templates/tsconfig.json`.

`cloudflare-oauth/` is deliberately outside that tsconfig. It needs
`@cloudflare/workers-oauth-provider`, `@cloudflare/workers-types`, and vitest,
none of which this repository installs, and it uses bundler-style extensionless
imports that the repo's NodeNext resolution would reject.

The practical consequence: **nothing in `cloudflare-oauth/src/` is compiled or
executed by `npm run verify`.** Its `proxy.test.ts` does not run here either. The
only coverage is the scaffolding assertions in `packages/cli/test/oauth-proxy.test.ts`,
which check that files are emitted and tokens expanded, not that the code is
sound. After editing those files, typecheck them from a generated project against
its own `tsconfig.json`.
