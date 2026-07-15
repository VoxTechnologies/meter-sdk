import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaces = ["./packages/sdk", "./packages/mcp", "./packages/adapters", "./packages/cli"];
const temp = mkdtempSync(path.join(tmpdir(), "meter-sdk-pack-"));

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

try {
  const tarballs = [];
  for (const workspace of workspaces) {
    const output = JSON.parse(
      run("npm", ["pack", workspace, "--json", "--ignore-scripts", "--pack-destination", temp])
    )[0];
    assert.ok(output.filename, `${workspace} did not produce a tarball`);
    assert.ok(output.size > 0 && output.size < 100_000, `${workspace} tarball size is unexpected`);
    const files = output.files.map((file) => file.path);
    for (const required of [
      "package.json",
      "README.md",
      "CHANGELOG.md",
      "LICENSE",
      "dist/index.js",
      "dist/index.cjs",
      "dist/index.d.ts",
      "dist/index.d.cts",
    ]) {
      assert.ok(files.includes(required), `${workspace} is missing ${required}`);
    }
    assert.ok(!files.some((file) => file.startsWith("src/") || file.startsWith("test/")), `${workspace} leaks source or tests`);
    tarballs.push(path.join(temp, output.filename));
  }

  const consumer = path.join(temp, "consumer");
  run("mkdir", ["-p", consumer]);
  writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({ name: "meter-sdk-consumer", private: true, type: "module" }, null, 2)
  );
  run("npm", ["install", "--ignore-scripts", "--no-package-lock", ...tarballs], { cwd: consumer });
  writeFileSync(
    path.join(consumer, "consumer.mjs"),
    `import { MeterPublicApiClient, verifyMeterWebhookSignature } from "@meter-mcp/sdk";\n` +
      `import { paidTool } from "@meter-mcp/mcp";\n` +
      `import { createBuyerPortalHandler } from "@meter-mcp/adapters";\n` +
      `import { cliName } from "@meter-mcp/cli";\n` +
      `if (![MeterPublicApiClient, verifyMeterWebhookSignature, paidTool, createBuyerPortalHandler, cliName].every(Boolean)) process.exit(1);\n`
  );
  run(process.execPath, ["consumer.mjs"], { cwd: consumer });
  writeFileSync(
    path.join(consumer, "consumer.cjs"),
    `const sdk = require("@meter-mcp/sdk");\n` +
      `const mcp = require("@meter-mcp/mcp");\n` +
      `const adapters = require("@meter-mcp/adapters");\n` +
      `const cli = require("@meter-mcp/cli");\n` +
      `if (![sdk.MeterPublicApiClient, sdk.verifyMeterWebhookSignature, mcp.paidTool, adapters.createBuyerPortalHandler, cli.cliName].every(Boolean)) process.exit(1);\n`
  );
  run(process.execPath, ["consumer.cjs"], { cwd: consumer });
  writeFileSync(
    path.join(consumer, "consumer.ts"),
    `import { MeterPublicApiClient, type MeterUsageReport } from "@meter-mcp/sdk";\n` +
      `import { paidTool } from "@meter-mcp/mcp";\n` +
      `import { createBuyerPortalHandler } from "@meter-mcp/adapters";\n` +
      `import { cliName } from "@meter-mcp/cli";\n` +
      `const meter = new MeterPublicApiClient({ baseUrl: "https://meter.example", serviceId: "service" });\n` +
      `const report: MeterUsageReport | undefined = undefined;\n` +
      `void [meter, report, paidTool, createBuyerPortalHandler, cliName];\n`
  );
  writeFileSync(
    path.join(consumer, "consumer.cts"),
    `import sdk = require("@meter-mcp/sdk");\n` +
      `import mcp = require("@meter-mcp/mcp");\n` +
      `import adapters = require("@meter-mcp/adapters");\n` +
      `import cli = require("@meter-mcp/cli");\n` +
      `const meter = new sdk.MeterPublicApiClient({ baseUrl: "https://meter.example", serviceId: "service" });\n` +
      `void [meter, mcp.paidTool, adapters.createBuyerPortalHandler, cli.cliName];\n`
  );
  writeFileSync(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", lib: ["ES2022", "DOM"] }, include: ["consumer.ts", "consumer.cts"] }, null, 2)
  );
  run(path.join(root, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], { cwd: consumer });

  const manifests = tarballs.map((tarball) => path.basename(tarball));
  console.log(JSON.stringify({ ok: true, tarballs: manifests, consumer: ["esm", "commonjs", "typescript-esm", "typescript-commonjs"] }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
