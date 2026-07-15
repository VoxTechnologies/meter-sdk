import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { MeterPublicApiClient } from "@meter-mcp/sdk";
import { resolveConnection, type ResolvedConnection } from "./config.js";

export type CliIo = {
  out: (line: string) => void;
  err: (line: string) => void;
  prompt: (question: string, options?: { secret?: boolean }) => Promise<string>;
};

export type CliContext = {
  client: MeterPublicApiClient;
  connection: ResolvedConnection;
  json: boolean;
  io: CliIo;
  configPath?: string;
};

export function nodeIo(): CliIo {
  return {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    prompt: async (question, options) => {
      // Secret prompts route echo into a sink so the key never appears on screen.
      const muted = options?.secret;
      const output = muted
        ? new Writable({ write: (_chunk, _enc, done) => done() })
        : process.stdout;
      if (muted) process.stdout.write(question);
      const rl = createInterface({ input: process.stdin, output, terminal: true });
      try {
        const answer = await rl.question(muted ? "" : question);
        if (muted) process.stdout.write("\n");
        return answer.trim();
      } finally {
        rl.close();
      }
    },
  };
}

export function createContext(
  overrides: {
    profile?: string;
    baseUrl?: string;
    serviceId?: string;
    apiKey?: string;
    json?: boolean;
    configPath?: string;
  },
  io: CliIo,
  fetchImpl?: typeof fetch
): CliContext {
  const connection = resolveConnection(overrides);
  return {
    client: new MeterPublicApiClient({
      baseUrl: connection.baseUrl,
      serviceId: connection.serviceId,
      serviceApiKey: connection.apiKey,
      timeoutMs: 30_000,
      fetchImpl,
    }),
    connection,
    json: overrides.json ?? false,
    io,
    configPath: overrides.configPath,
  };
}
