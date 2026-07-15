import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCliConfig } from "../src/config.js";
import { runInit } from "../src/commands/init.js";

test("init scaffolds the template, registers the service, and saves the profile", async () => {
  const workDir = mkdtempSync(join(tmpdir(), "meter-init-"));
  const configFile = join(workDir, "config.json");
  const projectDir = join(workDir, "my-books");
  const created: unknown[] = [];
  const io = { out: () => {}, err: () => {}, prompt: async () => "" };

  await runInit({
    name: "my-books",
    dir: projectDir,
    baseUrl: "https://meter.example",
    onboardingKey: "ok_test",
    install: false,
    configPath: configFile,
    io,
    onboarding: {
      createService: async (input) => {
        created.push(input);
        return { service: { id: "my-books", name: "my-books" }, apiKey: { secret: "sk_new" } };
      },
    },
  });

  assert.equal((created[0] as { slug: string }).slug, "my-books");
  assert.deepEqual((created[0] as { integration: { toolPrices: object } }).integration.toolPrices, {
    echo: 1,
    summarize: 5,
  });
  assert.ok(existsSync(join(projectDir, "src", "server.ts")));
  const env = readFileSync(join(projectDir, ".env"), "utf8");
  assert.match(env, /METER_API_URL=https:\/\/meter\.example/);
  assert.match(env, /METER_SERVICE_API_KEY=sk_new/);
  const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
  assert.equal(pkg.name, "my-books");
  const config = loadCliConfig(configFile);
  assert.equal(config.profiles["my-books"]?.apiKey, "sk_new");
  assert.equal(config.activeProfile, "my-books");
});

test("init refuses a non-empty target directory", async () => {
  const workDir = mkdtempSync(join(tmpdir(), "meter-init-"));
  // Occupy the target directory so the non-empty check trips.
  writeFileSync(join(workDir, "occupied.txt"), "");
  const io = { out: () => {}, err: () => {}, prompt: async () => "" };
  await assert.rejects(
    runInit({
      name: "x",
      dir: workDir,
      baseUrl: "https://meter.example",
      onboardingKey: "ok",
      install: false,
      io,
      onboarding: {
        createService: async () => ({ service: { id: "x", name: "x" }, apiKey: { secret: "s" } }),
      },
    })
  );
});
