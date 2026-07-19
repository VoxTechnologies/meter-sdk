function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// The consent page doubles as the whole buyer-identity flow: Meter MCP buyers
// are account-less prepaid credit holders, so "logging in" is either minting a
// fresh buyer or pasting an existing buyer token.
export function renderConsentPage(input: {
  serviceName: string
  clientName: string
  encodedState: string
  error?: string
}): string {
  const service = escapeHtml(input.serviceName)
  const client = escapeHtml(input.clientName)
  const state = escapeHtml(input.encodedState)
  const error = input.error ? `<p class="error">${escapeHtml(input.error)}</p>` : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to ${service}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a2e; }
  h1 { font-size: 1.25rem; }
  fieldset { border: 1px solid #d4d4e0; border-radius: 8px; margin: 1rem 0; padding: 1rem; }
  label { display: block; margin: .5rem 0 .25rem; }
  input[type=text], input[type=password] { width: 100%; padding: .5rem; border: 1px solid #c4c4d0; border-radius: 6px; box-sizing: border-box; }
  button { background: #4f46e5; color: #fff; border: 0; border-radius: 8px; padding: .6rem 1.2rem; font-size: 1rem; cursor: pointer; margin-top: 1rem; }
  .error { color: #b00020; }
  .hint { color: #5a5a6e; font-size: .85rem; }
</style>
</head>
<body>
<h1>Connect <strong>${client}</strong> to ${service}</h1>
<p>Tool calls are billed in prepaid credits. Approving creates or links a buyer credit account for this connection.</p>
${error}
<form method="post" action="/authorize">
  <input type="hidden" name="state" value="${state}">
  <fieldset>
    <label><input type="radio" name="mode" value="new" checked> Create a new buyer account</label>
    <p class="hint">Starts at 0 credits. Top up from the payment link a tool returns when credits run out.</p>
    <label><input type="radio" name="mode" value="existing"> Use an existing buyer</label>
    <label for="customerLocalId">Buyer customer id</label>
    <input type="text" id="customerLocalId" name="customerLocalId" autocomplete="off">
    <label for="buyerToken">Buyer token</label>
    <input type="password" id="buyerToken" name="buyerToken" autocomplete="off">
  </fieldset>
  <button type="submit">Approve connection</button>
</form>
</body>
</html>`
}

// Shown after minting a fresh buyer so the human can save the id + token. A new
// anonymous buyer is created per connection, so without surfacing these a
// disconnect/reconnect would orphan any prepaid balance with no way to recover
// it. Completion re-submits through the validated existing-buyer path.
export function renderProvisionedPage(input: {
  serviceName: string
  customerLocalId: string
  buyerToken: string
  encodedState: string
}): string {
  const service = escapeHtml(input.serviceName)
  const customerLocalId = escapeHtml(input.customerLocalId)
  const buyerToken = escapeHtml(input.buyerToken)
  const state = escapeHtml(input.encodedState)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Save your ${service} buyer credentials</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a2e; }
  h1 { font-size: 1.25rem; }
  code { display: block; background: #f2f2f7; border-radius: 6px; padding: .5rem; margin: .25rem 0 1rem; word-break: break-all; }
  .warn { color: #b00020; font-weight: 600; }
  button { background: #4f46e5; color: #fff; border: 0; border-radius: 8px; padding: .6rem 1.2rem; font-size: 1rem; cursor: pointer; }
</style>
</head>
<body>
<h1>Save these before continuing</h1>
<p class="warn">This is the only time the token is shown. Store both to top up credits or reconnect this buyer later — a new connection creates a new buyer and cannot see this balance.</p>
<p>Buyer customer id</p>
<code>${customerLocalId}</code>
<p>Buyer token</p>
<code>${buyerToken}</code>
<form method="post" action="/authorize">
  <input type="hidden" name="state" value="${state}">
  <input type="hidden" name="mode" value="confirm">
  <input type="hidden" name="customerLocalId" value="${customerLocalId}">
  <input type="hidden" name="buyerToken" value="${buyerToken}">
  <button type="submit">I saved them — complete connection</button>
</form>
</body>
</html>`
}
