import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
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

test("init resolves templates from the BUILT bundle end-to-end", async (t) => {
  // Guards the tsup-bundled binary: dist/cli.js sits at a different depth than
  // src/commands/init.ts, so a fixed-depth templates path would ENOENT here even
  // though the source-run tests pass. The root `verify` script builds before test.
  const distCli = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");
  if (!existsSync(distCli)) {
    t.skip("dist/cli.js not built; run `npm run build -w @meter-mcp/cli` first");
    return;
  }

  const workDir = mkdtempSync(join(tmpdir(), "meter-init-dist-"));
  const projectDir = join(workDir, "distproj");
  const xdg = join(workDir, "xdg");

  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/onboarding/v1/services") {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          service: { id: "distproj", name: "distproj" },
          apiKey: { id: "k", name: "k", last4: "abcd", secret: "sk_dist" },
          integration: null,
        })
      );
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  try {
    // spawn (not spawnSync): the child's onboarding call must reach the in-process
    // mock above, so this test process's event loop has to stay free to answer it.
    const child = spawn(
      process.execPath,
      [
        distCli,
        "init",
        "distproj",
        "--dir",
        projectDir,
        "--base-url",
        `http://127.0.0.1:${port}`,
        "--onboarding-key",
        "ok_test",
        "--no-install",
      ],
      { env: { ...process.env, XDG_CONFIG_HOME: xdg } }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const status = await new Promise<number | null>((resolve) =>
      child.on("close", (code) => resolve(code))
    );

    assert.equal(status, 0, `init exited ${status}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    assert.ok(existsSync(join(projectDir, "src", "server.ts")), "template server.ts was scaffolded");
    const env = readFileSync(join(projectDir, ".env"), "utf8");
    assert.match(env, new RegExp(`METER_API_URL=http://127\\.0\\.0\\.1:${port}`));
    assert.match(env, /METER_SERVICE_ID=distproj/);
    assert.match(env, /METER_SERVICE_API_KEY=sk_dist/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
