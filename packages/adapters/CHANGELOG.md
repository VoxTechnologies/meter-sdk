# @meter-mcp/adapters

## 0.4.1

### Patch Changes

- @meter-mcp/sdk@0.4.1

## 0.4.0

### Patch Changes

- @meter-mcp/sdk@0.4.0

## 0.3.0

### Patch Changes

- @meter-mcp/sdk@0.3.0

## 0.2.0

### Patch Changes

- 438038d: Make response types honest and harden the commit path.

  - `upsertCustomer` now types `apiKey` as optional: the server returns it only on
    first creation, never on idempotent upserts.
  - `MeterAuthorizeResponse.quote` matches the server's rated quote: no
    `customerLocalId`, and `credits` may be `0`.
  - `reservation` is typed `MeterCreditReservation | null` on authorize, commit,
    and release responses.
  - `meterToolCall`/`withUsage` now retry a failed commit up to 3 times with
    exponential backoff (network errors and 5xx only, never 4xx). If retries are
    exhausted, the new `MeterCommitFailedError` is thrown carrying the tool result
    and the `requestId` so callers can keep the result and re-commit later
    (commit is idempotent on `requestId`).
  - Adapters: document that Anthropic `cache_creation_input_tokens` stays in the
    billable input count (there is no distinct cache-creation field), and lock the
    cache-token bucketing with priced tests.

- Updated dependencies [438038d]
- Updated dependencies [fdc6358]
  - @meter-mcp/sdk@0.2.0

## 0.1.1

### Patch Changes

- Publish the public Meter SDK packages from the `@meter-mcp` scope using npm trusted publishing.
- Updated dependencies
  - @meter-mcp/sdk@0.1.1

## 0.1.0

- Initial public Fetch and Express adapters for hosted buyer and operator sessions.
