// Runtime configuration for the OAuth proxy, read from Wrangler vars. The
// Worker is fully generic — it fronts any Meter-backed service whose backend
// exposes the buyer-provisioning contract (see README) — so nothing here is
// baked into source; it all arrives as env.
export interface Env {
  OAUTH_KV: KVNamespace
  OAUTH_PROVIDER: unknown
  /** Base URL of the service backend that exposes /api/mcp/... and /api/meter/customers. */
  BACKEND_BASE_URL: string
  /** MCP endpoint path to proxy, e.g. /api/mcp/fto. */
  MCP_PATH: string
  /** Buyer-token header the backend expects, e.g. x-meter-buyer-token. */
  BUYER_HEADER: string
  /** Human-readable service name shown on the consent page. */
  SERVICE_NAME: string
}

export type Config = {
  backendBaseUrl: string
  mcpPath: string
  buyerHeader: string
  serviceName: string
}

export function configFromEnv(env: Env): Config {
  return {
    backendBaseUrl: (env.BACKEND_BASE_URL ?? '').replace(/\/$/, ''),
    mcpPath: env.MCP_PATH || '/api/mcp',
    buyerHeader: env.BUYER_HEADER || 'x-meter-buyer-token',
    serviceName: env.SERVICE_NAME || 'this service',
  }
}
