import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerPaidTool, type McpServerLike, type McpPaymentRequiredResult } from "@meter-mcp/mcp";
import { MeterPublicApiClient } from "@meter-mcp/sdk";
import { z } from "zod";

// On Cloudflare Workers, config arrives per-request as `env` (wrangler `vars` +
// secrets), not from process.env. The service API key is a secret — keep it in
// .dev.vars locally and `wrangler secret put METER_SERVICE_API_KEY` in prod.
export interface Env {
  METER_API_URL: string;
  METER_SERVICE_ID: string;
  METER_SERVICE_API_KEY: string;
}

// Demo-grade buyer identification: the caller names itself with a header.
// Replace with real authentication (API keys, OAuth) before production.
type RequestExtra = {
  requestInfo?: { headers?: Record<string, string | string[] | undefined> };
};

function customerFromHeaders({ extra }: { extra: RequestExtra }): string {
  const header = extra.requestInfo?.headers?.["x-customer-id"];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error("missing x-customer-id header");
  return value;
}

type ToolResult = { content: Array<{ type: "text"; text: string }> };

function buildMcpServer(env: Env): McpServer {
  const meter = new MeterPublicApiClient({
    baseUrl: env.METER_API_URL,
    serviceId: env.METER_SERVICE_ID,
    serviceApiKey: env.METER_SERVICE_API_KEY,
  });

  const server = new McpServer({
    name: env.METER_SERVICE_ID ?? "my-service",
    version: "0.1.0",
  });

  // registerPaidTool targets the minimal `McpServerLike` shape. The official
  // McpServer.registerTool has a richer generic signature that the compiler
  // won't structurally match to it, but it IS call-compatible at runtime: it
  // invokes the handler as (parsedArgs, extra), and `extra` is the MCP
  // RequestHandlerExtra that carries requestInfo.headers. Bridge it once here;
  // every tool's pricing and handler below stays fully type-checked.
  const paidServer = server as unknown as McpServerLike<
    { text: string },
    RequestExtra,
    ToolResult | McpPaymentRequiredResult
  >;

  registerPaidTool({
    server: paidServer,
    meter,
    name: "echo",
    definition: {
      description: "Echo the input back (flat price)",
      inputSchema: { text: z.string() },
    },
    billing: { customer: customerFromHeaders, credits: 1 },
    handler: async (input) => ({
      content: [{ type: "text" as const, text: input.text }],
    }),
  });

  registerPaidTool({
    server: paidServer,
    meter,
    name: "summarize",
    definition: {
      description: "Summarize text (price scales with input size)",
      inputSchema: { text: z.string() },
    },
    billing: {
      customer: customerFromHeaders,
      // Input-based dynamic pricing: 1 credit per started 100 chars, plus base 1.
      credits: ({ input }) => 1 + Math.ceil(input.text.length / 100),
    },
    handler: async (input) => ({
      content: [{ type: "text" as const, text: `${input.text.slice(0, 80)}...` }],
    }),
  });

  return server;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      body = undefined;
    }

    // Stateless mode: a fresh server + transport per request. enableJsonResponse
    // buffers the JSON-RPC response, so closing in `finally` cannot truncate it.
    const server = buildMcpServer(env);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request, { parsedBody: body });
    } finally {
      await server.close().catch(() => {});
    }
  },
};
