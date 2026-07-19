// Thin client for the service backend's Meter customer surface. The Worker owns
// no billing logic — buyer tokens are minted by the backend, and MCP tool calls
// pass straight through (see mcp.ts). The backend must expose:
//   POST /api/meter/customers                     -> { buyerToken }
//   POST /api/meter/customers/:id/token           -> { buyerToken, expiresIn }
// authenticated by the configured buyer-token header.

// The backend config travels INSIDE the grant props so the refresh callback
// (which the OAuth library invokes without `env`, and which can run on a cold
// isolate before any request populated a global) can always re-mint from props
// alone. Dropping this is what breaks re-mint on idle, low-traffic workers.
export type BuyerProps = {
  customerLocalId: string
  buyerToken: string
  backendBaseUrl: string
  mcpPath: string
  buyerHeader: string
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

export async function provisionBuyer(input: {
  backendBaseUrl: string
  fetchImpl?: typeof fetch
}): Promise<{ customerLocalId: string; buyerToken: string } | null> {
  const doFetch = input.fetchImpl ?? fetch
  const customerLocalId = `oauth-${crypto.randomUUID()}`
  const res = await doFetch(`${input.backendBaseUrl}/api/meter/customers`, {
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
export async function mintShortLivedToken(input: {
  backendBaseUrl: string
  buyerHeader: string
  customerLocalId: string
  buyerToken: string
  ttlSeconds?: number
  fetchImpl?: typeof fetch
}): Promise<string | null> {
  const doFetch = input.fetchImpl ?? fetch
  const res = await doFetch(
    `${input.backendBaseUrl}/api/meter/customers/${encodeURIComponent(input.customerLocalId)}/token`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        [input.buyerHeader]: input.buyerToken,
      },
      body: JSON.stringify(input.ttlSeconds !== undefined ? { ttlSeconds: input.ttlSeconds } : {}),
    },
  )
  if (!res.ok) return null
  const payload = (await readJson(res)) as { buyerToken?: string } | undefined
  return payload && typeof payload.buyerToken === 'string' ? payload.buyerToken : null
}
