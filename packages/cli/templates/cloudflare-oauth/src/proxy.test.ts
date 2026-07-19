import { describe, expect, it, vi } from 'vitest'
import type { BuyerProps } from './backend'
import { mintShortLivedToken, provisionBuyer } from './backend'
import { proxyMcpRequest } from './mcp'
import { refreshBuyerProps } from './refresh'
import { renderConsentPage, renderProvisionedPage } from './consent'

const PROPS: BuyerProps = {
  customerLocalId: 'buyer-1',
  buyerToken: 'tok',
  backendBaseUrl: 'https://svc.test',
  mcpPath: '/api/mcp/fto',
  buyerHeader: 'x-svc-buyer-token',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('provisionBuyer', () => {
  it('mints a fresh buyer identity', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ buyerToken: 'fresh' }, 201))
    const id = await provisionBuyer({ backendBaseUrl: 'https://svc.test', fetchImpl })
    expect(id?.buyerToken).toBe('fresh')
    expect(id?.customerLocalId).toMatch(/^oauth-/)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://svc.test/api/meter/customers')
  })

  it('returns null on failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'x' }, 502))
    expect(await provisionBuyer({ backendBaseUrl: 'https://svc.test', fetchImpl })).toBeNull()
  })
})

describe('mintShortLivedToken', () => {
  it('exchanges the token against the configured backend + header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ buyerToken: 'short', expiresIn: 3600 }))
    const fresh = await mintShortLivedToken({
      backendBaseUrl: 'https://svc.test',
      buyerHeader: 'x-svc-buyer-token',
      customerLocalId: 'buyer-1',
      buyerToken: 'long',
      ttlSeconds: 3600,
      fetchImpl,
    })
    expect(fresh).toBe('short')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://svc.test/api/meter/customers/buyer-1/token')
    expect(init.headers['x-svc-buyer-token']).toBe('long')
  })

  it('returns null when the token is invalid', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'x' }, 401))
    expect(
      await mintShortLivedToken({
        backendBaseUrl: 'https://svc.test',
        buyerHeader: 'x-svc-buyer-token',
        customerLocalId: 'b',
        buyerToken: 'x',
        fetchImpl,
      }),
    ).toBeNull()
  })
})

describe('refreshBuyerProps', () => {
  it('re-mints from props alone (no env / global) and preserves the config', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ buyerToken: 'fresh', expiresIn: 3600 }))
    const result = await refreshBuyerProps({ props: PROPS, fetchImpl })
    expect(result).toEqual({ newProps: { ...PROPS, buyerToken: 'fresh' } })
    // Uses the backend + header carried in props — works on any (even cold) isolate.
    expect(fetchImpl.mock.calls[0][0]).toBe('https://svc.test/api/meter/customers/buyer-1/token')
  })

  it('keeps props (undefined) when re-mint fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'x' }, 502))
    expect(await refreshBuyerProps({ props: PROPS, fetchImpl })).toBeUndefined()
  })
})

describe('proxyMcpRequest', () => {
  it('forwards JSON-RPC to the props MCP path with injected buyer headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', id: 2, result: { tools: [] } }))
    const req = new Request('https://worker.test/mcp', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    })
    const res = await proxyMcpRequest(req, { props: PROPS, fetchImpl })
    expect(res.status).toBe(200)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://svc.test/api/mcp/fto')
    expect(init.headers['x-meter-customer-id']).toBe('buyer-1')
    expect(init.headers['x-svc-buyer-token']).toBe('tok')
    expect(init.headers.accept).toBe('application/json, text/event-stream')
  })

  it('propagates a non-2xx upstream status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401))
    const req = new Request('https://worker.test/mcp', { method: 'POST', body: '{}' })
    const res = await proxyMcpRequest(req, { props: PROPS, fetchImpl })
    expect(res.status).toBe(401)
  })
})

describe('consent', () => {
  it('renders the service name, client, and both modes; escapes injection', () => {
    const html = renderConsentPage({ serviceName: 'Demo FTO', clientName: '<x>', encodedState: 's', error: 'e' })
    expect(html).toContain('Demo FTO')
    expect(html).toContain('value="new"')
    expect(html).toContain('value="existing"')
    expect(html).toContain('e')
    expect(html).not.toContain('<x>')
  })

  it('surfaces minted credentials for recovery', () => {
    const html = renderProvisionedPage({
      serviceName: 'Demo FTO',
      customerLocalId: 'oauth-abc',
      buyerToken: 'tok-xyz',
      encodedState: 's',
    })
    expect(html).toContain('oauth-abc')
    expect(html).toContain('tok-xyz')
    expect(html).toContain('value="confirm"')
  })
})
