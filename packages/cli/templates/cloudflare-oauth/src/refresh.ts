import { mintShortLivedToken, type BuyerProps } from './backend'

// The OAuth grant stores a short-lived buyer token; on every OAuth token
// exchange we re-mint it. Revoking the grant stops the re-mint, so spend stops
// within one TTL. Keep the buyer TTL longer than the access-token TTL so a
// refresh always lands while the current token is still valid.
export const SHORT_TOKEN_TTL_SECONDS = 3600

// Re-mints purely from the props the OAuth library hands us — no `env`, no
// module global — so this works on any isolate, including a cold one whose
// first request is the token refresh.
export async function refreshBuyerProps(input: {
  props: BuyerProps
  fetchImpl?: typeof fetch
}): Promise<{ newProps: BuyerProps } | undefined> {
  const fresh = await mintShortLivedToken({
    backendBaseUrl: input.props.backendBaseUrl,
    buyerHeader: input.props.buyerHeader,
    customerLocalId: input.props.customerLocalId,
    buyerToken: input.props.buyerToken,
    ttlSeconds: SHORT_TOKEN_TTL_SECONDS,
    fetchImpl: input.fetchImpl,
  })
  // Re-mint failed (token expired / backend blip): return "no change" so a
  // transient error does not tear down a live connection. The short TTL still
  // caps how long a revoked grant can keep spending. newProps carries the
  // config forward so the next refresh still has it.
  if (!fresh) return undefined
  return { newProps: { ...input.props, buyerToken: fresh } }
}
