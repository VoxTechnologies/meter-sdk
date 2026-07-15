import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCliConfig, saveCliConfig } from "../src/config.js";
import { runLogin, runLogout } from "../src/commands/auth.js";

function fakeIo(answers: string[]) {
  const lines: string[] = [];
  return {
    io: {
      out: (line: string) => lines.push(line),
      err: (line: string) => lines.push(line),
      prompt: async () => answers.shift() ?? "",
    },
    lines,
  };
}

test("login verifies the key with an authenticated call and saves the profile", async () => {
  const configFile = join(mkdtempSync(join(tmpdir(), "meter-cli-")), "config.json");
  const { io, lines } = fakeIo(["https://meter.example", "svc", "sk_test"]);
  let authHeader = "";
  await runLogin({ profile: "default", configPath: configFile }, io, async (input, init) => {
    authHeader = new Headers(init?.headers).get("authorization") ?? "";
    assert.match(String(input), /\/api\/v1\/services\/svc\/api-keys$/);
    return Response.json({ service: { id: "svc", name: "Svc" }, apiKeys: [] });
  });
  assert.equal(authHeader, "Bearer sk_test");
  const config = loadCliConfig(configFile);
  assert.equal(config.profiles.default?.apiKey, "sk_test");
  assert.equal(config.activeProfile, "default");
  assert.match(lines.at(-1) ?? "", /Logged in/);
});

test("login does not save when verification fails", async () => {
  const configFile = join(mkdtempSync(join(tmpdir(), "meter-cli-")), "config.json");
  const { io } = fakeIo(["https://meter.example", "svc", "sk_bad"]);
  await assert.rejects(
    runLogin({ profile: "default", configPath: configFile }, io, async () =>
      Response.json({ error: "unauthorized" }, { status: 401 })
    )
  );
  assert.deepEqual(loadCliConfig(configFile).profiles, {});
});

test("re-login preserves a cached buyer key for the same base URL and service", async () => {
  const configFile = join(mkdtempSync(join(tmpdir(), "meter-cli-")), "config.json");
  const verify = async () => Response.json({ service: { id: "svc", name: "Svc" }, apiKeys: [] });
  await runLogin(
    { profile: "default", baseUrl: "https://meter.example", serviceId: "svc", apiKey: "sk_test", configPath: configFile },
    fakeIo([]).io,
    verify
  );

  // Simulate the one-time buyer key that `meter call` caches after first use.
  const cached = loadCliConfig(configFile);
  cached.profiles.default!.testCustomerApiKey = "cust_sk_test";
  saveCliConfig(cached, configFile);

  await runLogin(
    { profile: "default", baseUrl: "https://meter.example", serviceId: "svc", apiKey: "sk_rotated", configPath: configFile },
    fakeIo([]).io,
    verify
  );
  const preserved = loadCliConfig(configFile);
  assert.equal(preserved.profiles.default?.apiKey, "sk_rotated");
  assert.equal(preserved.profiles.default?.testCustomerApiKey, "cust_sk_test");

  // A different service makes the cached buyer key stale — it must be dropped.
  await runLogin(
    { profile: "default", baseUrl: "https://meter.example", serviceId: "other-svc", apiKey: "sk_other", configPath: configFile },
    fakeIo([]).io,
    async () => Response.json({ service: { id: "other-svc", name: "Other" }, apiKeys: [] })
  );
  const dropped = loadCliConfig(configFile);
  assert.equal(dropped.profiles.default?.testCustomerApiKey, undefined);
});

test("logout removes the profile", async () => {
  const configFile = join(mkdtempSync(join(tmpdir(), "meter-cli-")), "config.json");
  const { io } = fakeIo(["https://meter.example", "svc", "sk_test"]);
  await runLogin({ profile: "default", configPath: configFile }, io, async () =>
    Response.json({ service: { id: "svc", name: "Svc" }, apiKeys: [] })
  );
  runLogout({ profile: "default", configPath: configFile }, io);
  assert.deepEqual(loadCliConfig(configFile).profiles, {});
});
