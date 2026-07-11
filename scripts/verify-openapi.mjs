import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const document = JSON.parse(readFileSync(path.join(root, "openapi/meter-v1.json"), "utf8"));

assert.equal(document.openapi, "3.1.0");
assert.match(document.info.version, /^1\./);
assert.ok(Object.keys(document.paths).length >= 20, "Public API contract is unexpectedly small");
for (const pathName of [
  "/api/v1/health",
  "/api/v1/meter/authorize",
  "/api/v1/meter/commit",
  "/api/v1/meter/release",
  "/api/v1/services/{serviceId}/integration",
  "/api/v1/services/{serviceId}/webhook-endpoints",
]) {
  assert.ok(document.paths[pathName], `Missing required public path: ${pathName}`);
}
console.log(JSON.stringify({ ok: true, version: document.info.version, paths: Object.keys(document.paths).length }, null, 2));
