import { createServer, type IncomingMessage } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerPaidTool, type McpServerLike, type McpPaymentRequiredResult } from "@meter-mcp/mcp";
import { MeterPublicApiClient } from "@meter-mcp/sdk";
import { z } from "zod";

const meter = new MeterPublicApiClient({
  baseUrl: process.env.METER_API_URL!,
  serviceId: process.env.METER_SERVICE_ID!,
  serviceApiKey: process.env.METER_SERVICE_API_KEY!,
});

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

function buildMcpServer(): McpServer {
  const server = new McpServer({
    name: process.env.METER_SERVICE_ID ?? "my-service",
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

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

const port = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/mcp") {
    res.statusCode = 404;
    res.end();
    return;
  }
  try {
    const body = await readJson(req);
    // Stateless mode: a fresh server+transport pair per request.
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
}).listen(port, () => {
  console.log(`MCP server listening on http://localhost:${port}/mcp`);
});
