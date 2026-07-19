import type { BuyerProps } from './backend'
import type { Config } from './config'

// Pass-through proxy: forward the JSON-RPC request verbatim to the backend's
// MCP endpoint and inject the buyer identity from the OAuth grant. The Worker
// re-implements no tools, so it can never drift from the backend's tool
// definitions or billing, and it never sees the Meter service key. The backend
// is expected to run its MCP endpoint statelessly.
export async function proxyMcpRequest(
  request: Request,
  input: { cfg: Config; props: BuyerProps; fetchImpl?: typeof fetch },
): Promise<Response> {
  const doFetch = input.fetchImpl ?? fetch
  const body = await request.text()

  const upstream = await doFetch(`${input.cfg.backendBaseUrl}${input.cfg.mcpPath}`, {
    method: 'POST',
    headers: {
      'content-type': request.headers.get('content-type') ?? 'application/json',
      // A WebStandard MCP transport requires both media types even in JSON
      // mode; force them so a client that sent only JSON is not 406'd upstream.
      accept: 'application/json, text/event-stream',
      'x-meter-customer-id': input.props.customerLocalId,
      [input.cfg.buyerHeader]: input.props.buyerToken,
    },
    body,
  })

  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  })
}
