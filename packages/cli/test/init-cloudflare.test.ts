import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/commands/init.js";

const mocks = () => ({
  onboarding: {
    createService: async () => ({
      service: { id: "wx", name: "wx" },
      apiKey: { secret: "sk_new" },
    }),
  },
  publicClient: {
    upsertCustomer: async () => ({ apiKey: "cust_sk_test" }),
  },
  io: { out: () => {}, err: () => {}, prompt: async () => "" },
});

test("init --target cloudflare scaffolds a Workers project", async () => {
  const workDir = mkdtempSync(join(tmpdir(), "meter-init-cf-"));
  const configFile = join(workDir, "config.json");
  const projectDir = join(workDir, "wx");
  const m = mocks();

  await runInit({
    name: "wx",
    dir: projectDir,
    baseUrl: "https://meter.example",
    onboardingKey: "ok_test",
    target: "cloudflare",
    install: false,
    configPath: configFile,
    io: m.io,
    onboarding: m.onboarding,
    publicClient: m.publicClient,
  });

  // Workers entry, not a node http server.
  const server = readFileSync(join(projectDir, "src", "server.ts"), "utf8");
  assert.match(server, /export default/);
  assert.match(server, /WebStandardStreamableHTTPServerTransport/);
  assert.doesNotMatch(server, /node:http/);

  // wrangler config, token-expanded.
  assert.ok(existsSync(join(projectDir, "wrangler.jsonc")));
  const wrangler = readFileSync(join(projectDir, "wrangler.jsonc"), "utf8");
  assert.match(wrangler, /"name":\s*"wx"/);
  assert.match(wrangler, /nodejs_compat/);
  assert.match(wrangler, /"METER_API_URL":\s*"https:\/\/meter\.example"/);
  // The service API key is a secret — it must NOT be baked into wrangler.jsonc.
  assert.doesNotMatch(wrangler, /sk_new/);

  // package.json wires wrangler.
  const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
  assert.equal(pkg.name, "wx");
  assert.equal(pkg.scripts.deploy, "wrangler deploy");
  assert.ok(pkg.devDependencies.wrangler);
  assert.ok(!pkg.dependencies.tsx);

  // The secret lands in .dev.vars (wrangler dev reads it) and is gitignored.
  const devVars = readFileSync(join(projectDir, ".dev.vars"), "utf8");
  assert.match(devVars, /METER_SERVICE_API_KEY=sk_new/);
  const gitignore = readFileSync(join(projectDir, ".gitignore"), "utf8");
  assert.match(gitignore, /\.dev\.vars/);
  assert.match(gitignore, /\.wrangler/);
});

test("init defaults to the node target", async () => {
  const workDir = mkdtempSync(join(tmpdir(), "meter-init-node-"));
  const projectDir = join(workDir, "nx");
  const m = mocks();

  await runInit({
    name: "nx",
    dir: projectDir,
    baseUrl: "https://meter.example",
    onboardingKey: "ok_test",
    install: false,
    configPath: join(workDir, "config.json"),
    io: m.io,
    onboarding: m.onboarding,
    publicClient: m.publicClient,
  });

  const server = readFileSync(join(projectDir, "src", "server.ts"), "utf8");
  assert.match(server, /node:http/);
  assert.ok(!existsSync(join(projectDir, "wrangler.jsonc")));
});
