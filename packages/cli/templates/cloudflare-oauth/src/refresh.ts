import { mintShortLivedToken, type BuyerProps } from './backend'
import type { Config } from './config'

// The OAuth grant stores a short-lived buyer token; on every OAuth token
// exchange we re-mint it. Revoking the grant stops the re-mint, so spend stops
// within one TTL. Keep the buyer TTL longer than the access-token TTL so a
// refresh always lands while the current token is still valid.
export const SHORT_TOKEN_TTL_SECONDS = 3600

export async function refreshBuyerProps(input: {
  cfg: Config
  props: BuyerProps
  fetchImpl?: typeof fetch
}): Promise<{ newProps: BuyerProps } | undefined> {
  const fresh = await mintShortLivedToken(input.cfg, {
    customerLocalId: input.props.customerLocalId,
    buyerToken: input.props.buyerToken,
    ttlSeconds: SHORT_TOKEN_TTL_SECONDS,
    fetchImpl: input.fetchImpl,
  })
  // Re-mint failed (token expired / backend blip): return "no change" so a
  // transient error does not tear down a live connection. The short TTL still
  // caps how long a revoked grant can keep spending.
  if (!fresh) return undefined
  return { newProps: { customerLocalId: input.props.customerLocalId, buyerToken: fresh } }
}
