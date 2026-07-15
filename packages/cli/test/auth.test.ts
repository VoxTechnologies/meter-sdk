import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCliConfig } from "../src/config.js";
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

test("logout removes the profile", async () => {
  const configFile = join(mkdtempSync(join(tmpdir(), "meter-cli-")), "config.json");
  const { io } = fakeIo(["https://meter.example", "svc", "sk_test"]);
  await runLogin({ profile: "default", configPath: configFile }, io, async () =>
    Response.json({ service: { id: "svc", name: "Svc" }, apiKeys: [] })
  );
  runLogout({ profile: "default", configPath: configFile }, io);
  assert.deepEqual(loadCliConfig(configFile).profiles, {});
});
