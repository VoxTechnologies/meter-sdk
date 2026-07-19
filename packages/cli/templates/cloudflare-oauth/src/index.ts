import OAuthProvider, { type OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import { configFromEnv, type Config, type Env as BaseEnv } from './config'
import { renderConsentPage, renderProvisionedPage } from './consent'
import { mintShortLivedToken, provisionBuyer, type BuyerProps } from './backend'
import { proxyMcpRequest } from './mcp'
import { refreshBuyerProps, SHORT_TOKEN_TTL_SECONDS } from './refresh'

// Access tokens live half as long as the buyer token, so a refresh always
// re-mints while the current buyer token is still valid; revoking the OAuth
// grant stops the re-mint and spend halts within SHORT_TOKEN_TTL_SECONDS.
const ACCESS_TOKEN_TTL_SECONDS = SHORT_TOKEN_TTL_SECONDS / 2

type Env = Omit<BaseEnv, 'OAUTH_PROVIDER'> & { OAUTH_PROVIDER: OAuthHelpers }

// Everything the refresh callback and the proxy need travels in the grant
// props (stamped at consent time), so neither depends on `env` — which the
// OAuth library does not pass to tokenExchangeCallback, and which a cold
// isolate serving a /token refresh first would not have populated into a global.
function propsFromConfig(cfg: Config, identity: { customerLocalId: string; buyerToken: string }): BuyerProps {
  return {
    customerLocalId: identity.customerLocalId,
    buyerToken: identity.buyerToken,
    backendBaseUrl: cfg.backendBaseUrl,
    mcpPath: cfg.mcpPath,
    buyerHeader: cfg.buyerHeader,
  }
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function encodeState(value: unknown): string {
  return btoa(JSON.stringify(value))
}

function decodeState<T>(value: string): T | null {
  try {
    return JSON.parse(atob(value)) as T
  } catch {
    return null
  }
}

async function clientNameFor(env: Env, clientId: string): Promise<string> {
  try {
    const client = await env.OAUTH_PROVIDER.lookupClient(clientId)
    return client?.clientName || client?.clientId || 'an MCP client'
  } catch {
    return 'an MCP client'
  }
}

async function handleAuthorizeGet(request: Request, env: Env, cfg: Config): Promise<Response> {
  const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request)
  const clientName = await clientNameFor(env, oauthReq.clientId)
  return html(renderConsentPage({ serviceName: cfg.serviceName, clientName, encodedState: encodeState(oauthReq) }))
}

async function handleAuthorizePost(request: Request, env: Env, cfg: Config): Promise<Response> {
  const form = await request.formData()
  const state = String(form.get('state') ?? '')
  const oauthReq = decodeState<Parameters<OAuthHelpers['completeAuthorization']>[0]['request']>(state)
  if (!oauthReq || !oauthReq.clientId || !oauthReq.redirectUri) {
    return html('<p>Invalid or expired authorization request.</p>', 400)
  }
  // Validate the client BEFORE any buyer provisioning: otherwise a forged state
  // (mode=new, empty client) would mint a Meter customer on an unauthenticated
  // POST. A real registered client is required to get this far.
  const client = await env.OAUTH_PROVIDER.lookupClient(oauthReq.clientId)
  if (!client) return html('<p>Unknown OAuth client.</p>', 400)
  const clientName = client.clientName || client.clientId || 'an MCP client'
  const consent = (error?: string, status = 200) =>
    html(renderConsentPage({ serviceName: cfg.serviceName, clientName, encodedState: state, error }), status)

  const mode = String(form.get('mode') ?? 'new')

  if (mode === 'new') {
    const provisioned = await provisionBuyer({ backendBaseUrl: cfg.backendBaseUrl })
    if (!provisioned) return consent('buyer_provisioning_failed', 502)
    // Surface the credentials before completing, so the balance is recoverable.
    return html(
      renderProvisionedPage({
        serviceName: cfg.serviceName,
        customerLocalId: provisioned.customerLocalId,
        buyerToken: provisioned.buyerToken,
        encodedState: state,
      }),
    )
  }

  // Both the explicit "existing buyer" path and the post-mint "confirm" step
  // land here. Re-minting a short token also validates the token↔customer
  // binding server-side (a bad pair returns null → 401). The grant stores the
  // SHORT token, not the caller's long-lived one, so its spend is bounded by
  // the TTL and refreshed (or not, if revoked) on every OAuth token exchange.
  const customerLocalId = String(form.get('customerLocalId') ?? '').trim()
  const buyerToken = String(form.get('buyerToken') ?? '').trim()
  const shortToken =
    customerLocalId !== '' && buyerToken !== ''
      ? await mintShortLivedToken({
          backendBaseUrl: cfg.backendBaseUrl,
          buyerHeader: cfg.buyerHeader,
          customerLocalId,
          buyerToken,
          ttlSeconds: SHORT_TOKEN_TTL_SECONDS,
        })
      : null
  if (!shortToken) return consent('invalid_buyer_token', 401)
  const props = propsFromConfig(cfg, { customerLocalId, buyerToken: shortToken })

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReq,
    userId: props.customerLocalId,
    metadata: { via: 'meter-oauth-proxy' },
    scope: [],
    props,
  })
  return Response.redirect(redirectTo, 302)
}

const defaultHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cfg = configFromEnv(env)
    const url = new URL(request.url)
    if (url.pathname === '/authorize' && request.method === 'GET') return handleAuthorizeGet(request, env, cfg)
    if (url.pathname === '/authorize' && request.method === 'POST') return handleAuthorizePost(request, env, cfg)
    if (url.pathname === '/') {
      return html(
        `<h1>${cfg.serviceName} MCP</h1><p>Remote MCP endpoint: <code>/mcp</code>. Connect from an MCP client via OAuth.</p>`,
      )
    }
    return new Response('Not found', { status: 404 })
  },
}

const apiHandler = {
  async fetch(request: Request, _env: Env, ctx: ExecutionContext & { props: BuyerProps }): Promise<Response> {
    if (new URL(request.url).pathname !== '/mcp') {
      return Response.json({ jsonrpc: '2.0', error: { code: -32000, message: 'Use /mcp' }, id: null }, { status: 404 })
    }
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed: stateless server, use POST' },
          id: null,
        }),
        { status: 405, headers: { 'content-type': 'application/json', allow: 'POST' } },
      )
    }
    // The grant props carry the backend config, so the proxy needs no env.
    return proxyMcpRequest(request, { props: ctx.props })
  },
}

export default new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler: apiHandler as never,
  defaultHandler: defaultHandler as never,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
  accessTokenTTL: ACCESS_TOKEN_TTL_SECONDS,
  // On every token exchange (initial code + each refresh) re-mint the buyer
  // token from the one currently in the grant. The grant props carry the
  // backend config, so this always re-mints — even on a cold isolate — and a
  // revoked grant simply stops refreshing, so its short buyer token expires and
  // spend stops.
  tokenExchangeCallback: async (options: { props: BuyerProps }) => {
    return refreshBuyerProps({ props: options.props })
  },
})
