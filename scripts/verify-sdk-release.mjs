import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifests = ["sdk", "mcp", "adapters", "cli"].map((name) =>
  JSON.parse(readFileSync(path.join(root, "packages", name, "package.json"), "utf8"))
);
const versions = new Set(manifests.map((manifest) => manifest.version));
assert.equal(versions.size, 1, "All Meter SDK packages must have the same version");
const version = manifests[0].version;
const tag = process.env.GITHUB_REF_NAME ?? process.argv[2];
assert.equal(tag, `sdk-v${version}`, `Release tag must be sdk-v${version}`);
for (const manifest of manifests) {
  assert.equal(manifest.private, undefined, `${manifest.name} must be publishable`);
  assert.equal(manifest.publishConfig?.access, "public", `${manifest.name} must publish publicly`);
  assert.equal(manifest.publishConfig?.registry, "https://registry.npmjs.org", `${manifest.name} must target npmjs`);
  assert.equal(manifest.repository?.url, "git+https://github.com/masterleopold/meter-sdk.git", `${manifest.name} repository must match trusted publishing source`);
}
console.log(JSON.stringify({ ok: true, tag, version, packages: manifests.map((manifest) => manifest.name) }, null, 2));
