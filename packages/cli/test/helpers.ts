import { MeterPublicApiClient } from "@meter-mcp/sdk";
import type { CliContext } from "../src/context.js";

export type StubCall = { path: string; method: string; body?: unknown; query: URLSearchParams };

export function stubContext(
  respond: (call: StubCall) => unknown,
  options: { json?: boolean } = {}
): { ctx: CliContext; calls: StubCall[]; lines: string[] } {
  const calls: StubCall[] = [];
  const lines: string[] = [];
  const client = new MeterPublicApiClient({
    baseUrl: "https://meter.example",
    serviceId: "svc",
    serviceApiKey: "sk",
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      const call: StubCall = {
        path: url.pathname,
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        query: url.searchParams,
      };
      calls.push(call);
      return Response.json(respond(call));
    },
  });
  const ctx: CliContext = {
    client,
    connection: {
      baseUrl: "https://meter.example",
      serviceId: "svc",
      apiKey: "sk",
      profileName: "default",
    },
    json: options.json ?? false,
    io: {
      out: (line) => lines.push(line),
      err: (line) => lines.push(line),
      prompt: async () => "",
    },
  };
  return { ctx, calls, lines };
}
