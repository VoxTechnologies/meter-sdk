import type { Config } from './config'

// Thin client for the service backend's Meter customer surface. The Worker owns
// no billing logic — buyer tokens are minted by the backend, and MCP tool calls
// pass straight through (see mcp.ts). The backend must expose:
//   POST /api/meter/customers                     -> { buyerToken }
//   POST /api/meter/customers/:id/token           -> { buyerToken, expiresIn }
// authenticated by the configured buyer-token header.
export type BuyerProps = {
  customerLocalId: string
  buyerToken: string
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

export async function provisionBuyer(
  cfg: Config,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<BuyerProps | null> {
  const doFetch = opts.fetchImpl ?? fetch
  const customerLocalId = `oauth-${crypto.randomUUID()}`
  const res = await doFetch(`${cfg.backendBaseUrl}/api/meter/customers`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ customerLocalId, name: `MCP OAuth buyer ${customerLocalId.slice(0, 14)}` }),
  })
  if (!res.ok) return null
  const payload = (await readJson(res)) as { buyerToken?: string } | undefined
  if (!payload || typeof payload.buyerToken !== 'string') return null
  return { customerLocalId, buyerToken: payload.buyerToken }
}

// Exchanges a valid current buyer token for a fresh short-lived one. Doubles as
// validation: a 401 means the (customerLocalId, buyerToken) pair is invalid.
export async function mintShortLivedToken(
  cfg: Config,
  input: { customerLocalId: string; buyerToken: string; ttlSeconds?: number; fetchImpl?: typeof fetch },
): Promise<string | null> {
  const doFetch = input.fetchImpl ?? fetch
  const res = await doFetch(
    `${cfg.backendBaseUrl}/api/meter/customers/${encodeURIComponent(input.customerLocalId)}/token`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        [cfg.buyerHeader]: input.buyerToken,
      },
      body: JSON.stringify(input.ttlSeconds !== undefined ? { ttlSeconds: input.ttlSeconds } : {}),
    },
  )
  if (!res.ok) return null
  const payload = (await readJson(res)) as { buyerToken?: string } | undefined
  return payload && typeof payload.buyerToken === 'string' ? payload.buyerToken : null
}
