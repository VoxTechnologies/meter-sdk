import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "../config.js";
import type { CliIo } from "../context.js";

function packageRoot(): string {
  // Walk up to the nearest package.json so this resolves the same whether it
  // runs from src/commands (tsx), bundled into dist/cli.js (tsup), or an
  // installed node_modules/@meter-mcp/cli.
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new CliError("could not locate the @meter-mcp/cli package root");
    dir = parent;
  }
  return dir;
}

/**
 * Scaffold a Cloudflare Workers OAuth proxy that fronts an EXISTING
 * Meter-backed MCP endpoint. Unlike `meter init`, this creates no service and
 * runs no onboarding — it wraps a service you already run so OAuth-only MCP
 * clients can connect. The generated Worker is generic; the target is set via
 * Wrangler vars (backend URL, MCP path, buyer-token header, service name).
 */
export async function runOAuthProxy(opts: {
  name?: string;
  dir?: string;
  backendUrl?: string;
  mcpPath?: string;
  buyerHeader?: string;
  serviceName?: string;
  install?: boolean;
  io: CliIo;
  execInstall?: (cwd: string) => void;
}): Promise<void> {
  const io = opts.io;
  const name = (opts.name ?? (await io.prompt("Worker project name: "))).trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(name)) {
    throw new CliError("project name must be lowercase alphanumeric with - or _ (2-63 chars)");
  }
  const targetDir = resolve(opts.dir ?? name);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new CliError(`target directory ${targetDir} is not empty`);
  }

  const backendUrl = (
    opts.backendUrl ?? (await io.prompt("Service backend base URL (e.g. https://svc.example.com): "))
  ).trim();
  if (!/^https?:\/\//.test(backendUrl)) {
    throw new CliError("backend URL must be an http(s) URL");
  }
  const mcpPath = (opts.mcpPath ?? "/api/mcp").trim();
  if (!mcpPath.startsWith("/")) throw new CliError("mcp path must start with /");
  const buyerHeader = (opts.buyerHeader ?? "x-meter-buyer-token").trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(buyerHeader)) throw new CliError("buyer header must be a valid HTTP header name");
  const serviceName = (opts.serviceName ?? name).trim();

  const templates = join(packageRoot(), "templates", "cloudflare-oauth");

  // Copy the generic Worker source verbatim (it reads config from env).
  mkdirSync(join(targetDir, "src"), { recursive: true });
  for (const file of readdirSync(join(templates, "src"))) {
    cpSync(join(templates, "src", file), join(targetDir, "src", file));
  }
  cpSync(join(templates, "tsconfig.json"), join(targetDir, "tsconfig.json"));

  const tokens: Record<string, string> = {
    __PROJECT_NAME__: name,
    __BACKEND_BASE_URL__: backendUrl.replace(/\/$/, ""),
    __MCP_PATH__: mcpPath,
    __BUYER_HEADER__: buyerHeader,
    __SERVICE_NAME__: serviceName,
  };
  const expand = (template: string) =>
    Object.entries(tokens).reduce((text, [token, value]) => text.replaceAll(token, value), template);
  const render = (from: string, to: string) =>
    writeFileSync(join(targetDir, to), expand(readFileSync(join(templates, from), "utf8")));
  render("package.json.tmpl", "package.json");
  render("wrangler.jsonc.tmpl", "wrangler.jsonc");
  render("gitignore.tmpl", ".gitignore");
  render("README.md.tmpl", "README.md");

  if (opts.install !== false) {
    const install =
      opts.execInstall ??
      ((cwd: string) => {
        const result = spawnSync("npm", ["install"], { cwd, stdio: "inherit" });
        if (result.status !== 0) throw new CliError("npm install failed");
      });
    install(targetDir);
  }

  io.out("");
  io.out(`Done. Next steps:`);
  io.out(`  cd ${relative(process.cwd(), targetDir) || "."}`);
  io.out(`  npx wrangler kv namespace create OAUTH_KV   # paste the id into wrangler.jsonc`);
  io.out(`  npm run deploy`);
  io.out("");
  io.out(`Your backend must expose POST /api/meter/customers and`);
  io.out(`POST /api/meter/customers/:id/token (see README). Point an MCP client's`);
  io.out(`OAuth connector at the deployed Worker's /mcp endpoint.`);
}
