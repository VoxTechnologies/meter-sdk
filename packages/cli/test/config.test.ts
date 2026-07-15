import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CliError,
  configPath,
  loadCliConfig,
  resolveConnection,
  saveCliConfig,
} from "../src/config.js";

const profile = { baseUrl: "https://meter.example", serviceId: "svc", apiKey: "sk_1" };

test("configPath respects XDG_CONFIG_HOME", () => {
  assert.equal(configPath({ XDG_CONFIG_HOME: "/x" }), join("/x", "meter", "config.json"));
});

test("save/load round-trips with 0600 permissions", () => {
  const path = join(mkdtempSync(join(tmpdir(), "meter-cli-")), "config.json");
  saveCliConfig({ profiles: { default: profile }, activeProfile: "default" }, path);
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.deepEqual(loadCliConfig(path).profiles.default, profile);
});

test("loadCliConfig returns empty config for a missing file", () => {
  const config = loadCliConfig(join(tmpdir(), "does-not-exist", "config.json"));
  assert.deepEqual(config, { profiles: {}, activeProfile: "default" });
});

test("resolveConnection precedence is flags > env > profile", () => {
  const config = { profiles: { default: profile }, activeProfile: "default" };
  const env = { METER_API_KEY: "sk_env" };
  const fromEnv = resolveConnection({}, env, config);
  assert.equal(fromEnv.apiKey, "sk_env");
  assert.equal(fromEnv.baseUrl, profile.baseUrl);
  const fromFlag = resolveConnection({ apiKey: "sk_flag" }, env, config);
  assert.equal(fromFlag.apiKey, "sk_flag");
});

test("resolveConnection throws CliError exit 2 when incomplete", () => {
  assert.throws(
    () => resolveConnection({}, {}, { profiles: {}, activeProfile: "default" }),
    (error: unknown) => error instanceof CliError && error.exitCode === 2
  );
});
