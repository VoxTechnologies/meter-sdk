# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is (and is not)

This is the **public** half of Meter, an MCP prepaid-credit and usage-billing platform. It contains only client libraries, protocol types, adapters, examples, and the public OpenAPI contract. The billing engine, ledger, Stripe/payout processing, MCP Gateway, dashboards, and database schema live in a **separate private repository** and must never be added here. `openapi/meter-v1.json` is the checked-in copy of the server's public contract — the SDK's types are hand-written to mirror it, not generated from it.

Never commit service keys, webhook secrets, customer data, or internal server details. CI runs a full-history gitleaks scan on every push.

## Commands

```bash
npm install
npm run verify            # the gate: build + test + typecheck + publint/attw + OpenAPI + packed-consumer install + npm audit
npm run build             # tsup ESM+CJS+dts for all four packages
npm test                  # node:test via tsx across all packages
npm run typecheck
npm run changeset         # required for any user-visible change
```

Run a single test file (tests are plain `node:test` executed through `tsx`):

```bash
npx tsx --test packages/sdk/test/client.test.ts
```

Scope any script to one package with `-w`, e.g. `npm test -w @meter-mcp/sdk`.

There is no ESLint/Prettier config; `npm run lint:packages` lints *package metadata* (publint + are-the-types-wrong), not source style.

`scripts/verify-sdk-packages.mjs` is the strictest part of `verify`: it packs real tarballs, installs them into a clean consumer, and imports them from ESM, CommonJS, TS-ESM, and TS-CJS. Export-map or `.d.cts` regressions surface here, not in `npm test`.

## Architecture

Four npm workspaces under `packages/`, published together at a **single shared version** (Changesets `fixed` group; `scripts/verify-sdk-release.mjs` fails the release if versions diverge):

- `@meter-mcp/sdk` — zero-dependency HTTP client (`MeterPublicApiClient`), AI-cost math, webhook signature verification. Everything else depends on it.
- `@meter-mcp/mcp` — `paidTool` / `registerPaidTool`, which wrap an MCP tool handler in billing and translate a `402`-style error body into an MCP error result.
- `@meter-mcp/adapters` — provider usage extractors (`aiUsageFromOpenAI` / `aiUsageFromAnthropic`) and Web-`Request`/`Response` handlers for buyer-portal and operator-console sessions, plus an Express bridge.
- `@meter-mcp/cli` — the `meter` bin for provider developers: `login` / `init` (scaffolds an embedded-metering MCP server from `packages/cli/templates`, which ship in the tarball) / resource CRUD / `usage` + `events tail` / `webhooks` + `listen` (poll-mode webhook forwarding with client-side HMAC signing) / `call`. Commands are pure `run*(ctx, …)` functions in `src/commands/`; `src/cli.ts` only wires commander. Three wiring bugs unit tests cannot catch live in commander/bundle land — bin symlink vs `import.meta.url` realpath, global-vs-subcommand option shadowing, bundled-`dist` resource paths — which is why `test/init.test.ts` spawns the **built** `dist/cli.js` end-to-end; keep that test alive.

### The billing lifecycle

The core of the SDK is the three-phase call in `packages/sdk/src/client.ts`:

1. `authorize()` — reserves credits (a `MeterCreditReservation`, only when a `requestId` is supplied).
2. run the protected work; on throw, `release()` the reservation (best-effort, failures swallowed).
3. `commit()` — records the usage event. **Commit is idempotent server-side, keyed on `requestId`**, which is why `meterToolCall` retries it up to 3 times with backoff on 5xx/network errors and stops immediately on 4xx.

`meterToolCall` (aliased as `withUsage`) is that whole sequence; `paidTool` in `@meter-mcp/mcp` is a thin resolver layer on top of it. If the work succeeds but commit ultimately fails, the SDK throws `MeterCommitFailedError`, which **carries the tool result and the `requestId`** so a caller can keep the expensive result and re-commit later. Do not "simplify" that away.

### Type invariants worth preserving

- Request shapes and response shapes are deliberately *not* shared. `MeterAuthorizeResponse.quote` mirrors the server's rated quote (no echoed `customerLocalId`, `credits` may be `0`), so it must not be typed as `MeterToolCall`. `packages/sdk/test/response-types.test.ts` exists to pin these down.
- `upsertCustomer` returns the buyer `apiKey` **only on first creation** — it is optional, on purpose.
- AI cost is carried in integer **micro-USD** (`costMicrousd`) to avoid float drift; `costSource` distinguishes `reported` / `calculated` / `unpriced`.
- Anthropic's `input_tokens` excludes cache tokens while OpenAI's `prompt_tokens` includes them — the two adapters normalize this differently and the comments there explain why. Verify against provider docs before changing.

## Conventions

- ESM source (`.ts`, NodeNext), `"type": "module"`, relative imports carry the `.js` extension.
- Node >= 20; the SDK relies on global `fetch`, `crypto.randomUUID`, and `crypto.subtle` rather than any runtime dependency. Keep `@meter-mcp/sdk` dependency-free.
- New public API needs: an entry in `docs/SDK_API.md`, a test, and a changeset.
- Releases are tag-driven (`sdk-v<version>`) and publish via GitHub OIDC trusted publishing — see `docs/SDK_RELEASE.md`. Never overwrite a published version.
