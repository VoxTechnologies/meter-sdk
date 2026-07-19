import { describe, expect, it, vi } from 'vitest'
import type { Config } from './config'
import { mintShortLivedToken, provisionBuyer } from './backend'
import { proxyMcpRequest } from './mcp'
import { refreshBuyerProps } from './refresh'
import { renderConsentPage, renderProvisionedPage } from './consent'

const CFG: Config = {
  backendBaseUrl: 'https://svc.test',
  mcpPath: '/api/mcp/fto',
  buyerHeader: 'x-svc-buyer-token',
  serviceName: 'Demo FTO',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('provisionBuyer', () => {
  it('mints a fresh buyer and returns its props', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ buyerToken: 'fresh' }, 201))
    const props = await provisionBuyer(CFG, { fetchImpl })
    expect(props?.buyerToken).toBe('fresh')
    expect(props?.customerLocalId).toMatch(/^oauth-/)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://svc.test/api/meter/customers')
  })

  it('returns null on failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'x' }, 502))
    expect(await provisionBuyer(CFG, { fetchImpl })).toBeNull()
  })
})

describe('mintShortLivedToken', () => {
  it('exchanges the token against the configured backend + header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ buyerToken: 'short', expiresIn: 3600 }))
    const fresh = await mintShortLivedToken(CFG, {
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
    expect(await mintShortLivedToken(CFG, { customerLocalId: 'b', buyerToken: 'x', fetchImpl })).toBeNull()
  })
})

describe('refreshBuyerProps', () => {
  it('re-mints and returns newProps', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ buyerToken: 'fresh', expiresIn: 3600 }))
    const result = await refreshBuyerProps({
      cfg: CFG,
      props: { customerLocalId: 'buyer-1', buyerToken: 'cur' },
      fetchImpl,
    })
    expect(result).toEqual({ newProps: { customerLocalId: 'buyer-1', buyerToken: 'fresh' } })
  })

  it('keeps props (undefined) when re-mint fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'x' }, 502))
    expect(
      await refreshBuyerProps({ cfg: CFG, props: { customerLocalId: 'b', buyerToken: 'c' }, fetchImpl }),
    ).toBeUndefined()
  })
})

describe('proxyMcpRequest', () => {
  it('forwards JSON-RPC to the configured MCP path with injected buyer headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ jsonrpc: '2.0', id: 2, result: { tools: [] } }))
    const req = new Request('https://worker.test/mcp', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    })
    const res = await proxyMcpRequest(req, {
      cfg: CFG,
      props: { customerLocalId: 'buyer-1', buyerToken: 'tok' },
      fetchImpl,
    })
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
    const res = await proxyMcpRequest(req, { cfg: CFG, props: { customerLocalId: 'b', buyerToken: 't' }, fetchImpl })
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
