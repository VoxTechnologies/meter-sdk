import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOAuthProxy } from "../src/commands/oauth-proxy.js";

const io = { out: () => {}, err: () => {}, prompt: async () => "" };

test("oauth-proxy scaffolds a generic Workers OAuth proxy with the target in wrangler vars", async () => {
  const workDir = mkdtempSync(join(tmpdir(), "meter-oauth-"));
  const projectDir = join(workDir, "svc-oauth");

  await runOAuthProxy({
    name: "svc-oauth",
    dir: projectDir,
    backendUrl: "https://svc.example.com/",
    mcpPath: "/api/mcp/fto",
    buyerHeader: "x-svc-buyer-token",
    serviceName: "Demo FTO",
    install: false,
    io,
  });

  // Generic pass-through source, config read from env — not baked into source.
  const proxy = readFileSync(join(projectDir, "src", "mcp.ts"), "utf8");
  assert.match(proxy, /proxyMcpRequest/);
  assert.doesNotMatch(proxy, /svc\.example\.com/);
  const index = readFileSync(join(projectDir, "src", "index.ts"), "utf8");
  assert.match(index, /OAuthProvider/);

  // The target lands in wrangler vars, trailing slash trimmed.
  const wrangler = readFileSync(join(projectDir, "wrangler.jsonc"), "utf8");
  assert.match(wrangler, /"name":\s*"svc-oauth"/);
  assert.match(wrangler, /"BACKEND_BASE_URL":\s*"https:\/\/svc\.example\.com"/);
  assert.match(wrangler, /"MCP_PATH":\s*"\/api\/mcp\/fto"/);
  assert.match(wrangler, /"BUYER_HEADER":\s*"x-svc-buyer-token"/);
  assert.match(wrangler, /"SERVICE_NAME":\s*"Demo FTO"/);
  assert.match(wrangler, /nodejs_compat/);

  // package.json wires the OAuth provider + wrangler; ships the test.
  const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
  assert.equal(pkg.name, "svc-oauth");
  assert.equal(pkg.scripts.deploy, "wrangler deploy");
  assert.ok(pkg.dependencies["@cloudflare/workers-oauth-provider"]);
  assert.ok(existsSync(join(projectDir, "src", "proxy.test.ts")));
  const gitignore = readFileSync(join(projectDir, ".gitignore"), "utf8");
  assert.match(gitignore, /\.wrangler/);
});

test("oauth-proxy rejects a non-http backend URL", async () => {
  const workDir = mkdtempSync(join(tmpdir(), "meter-oauth-"));
  await assert.rejects(
    runOAuthProxy({
      name: "x",
      dir: join(workDir, "x"),
      backendUrl: "ftp://nope",
      install: false,
      io,
    }),
  );
});
