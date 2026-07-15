import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MeterOnboardingClient, MeterPublicApiClient } from "@meter-mcp/sdk";
import { CliError, loadCliConfig, saveCliConfig } from "../config.js";
import type { CliIo } from "../context.js";

const DEFAULT_BASE_URL = "https://meter-mcp.vercel.app";
const EXAMPLE_TOOL_PRICES = { echo: 1, summarize: 5 };

type OnboardingLike = {
  createService(input: {
    serviceId?: string;
    slug: string;
    name: string;
    integration?: { toolPrices: Record<string, number> };
  }): Promise<{ service: { id: string; name: string }; apiKey: { secret: string } }>;
};

type PublicClientLike = {
  upsertCustomer(input: {
    customerLocalId: string;
    name?: string;
    initialCredits?: number;
  }): Promise<{ apiKey?: string }>;
};

function packageRoot(): string {
  // Walk up to the nearest package.json so this resolves the same whether it runs
  // from src/commands (tsx) or bundled into dist/cli.js (tsup) or an installed
  // node_modules/@meter-mcp/cli — a fixed `../..` depth breaks across those.
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new CliError("could not locate the @meter-mcp/cli package root");
    }
    dir = parent;
  }
  return dir;
}

function templatesDir(): string {
  return join(packageRoot(), "templates");
}

export async function runInit(opts: {
  name?: string;
  dir?: string;
  baseUrl?: string;
  onboardingKey?: string;
  useProfile?: string;
  install?: boolean;
  configPath?: string;
  io: CliIo;
  onboarding?: OnboardingLike;
  publicClient?: PublicClientLike;
  execInstall?: (cwd: string) => void;
}): Promise<void> {
  const io = opts.io;
  const name = (opts.name ?? (await io.prompt("Project name: "))).trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(name)) {
    throw new CliError("project name must be lowercase alphanumeric with - or _ (2-63 chars)");
  }
  const targetDir = resolve(opts.dir ?? name);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new CliError(`target directory ${targetDir} is not empty`);
  }

  // Resolve service credentials: reuse a profile, or create a service via onboarding.
  let baseUrl: string;
  let serviceId: string;
  let apiKey: string;
  const config = loadCliConfig(opts.configPath);
  if (opts.useProfile) {
    const profile = config.profiles[opts.useProfile];
    if (!profile) throw new CliError(`profile "${opts.useProfile}" not found; run meter login first`);
    ({ baseUrl, serviceId, apiKey } = profile);
  } else {
    baseUrl =
      opts.baseUrl ?? ((await io.prompt(`Meter base URL [${DEFAULT_BASE_URL}]: `)) || DEFAULT_BASE_URL);
    const onboardingKey =
      opts.onboardingKey ??
      process.env.METER_ONBOARDING_KEY ??
      (await io.prompt("Onboarding key: ", { secret: true }));
    if (!onboardingKey) throw new CliError("an onboarding key is required to create a service");
    const onboarding =
      opts.onboarding ?? new MeterOnboardingClient({ baseUrl, onboardingApiKey: onboardingKey });
    const created = await onboarding.createService({
      serviceId: name,
      slug: name,
      name,
      integration: { toolPrices: EXAMPLE_TOOL_PRICES },
    });
    serviceId = created.service.id;
    apiKey = created.apiKey.secret;
    io.out(
      `Created service "${serviceId}" with example tool prices ${JSON.stringify(EXAMPLE_TOOL_PRICES)}.`
    );
  }

  // Fund a test buyer so the printed "meter call echo" next-step actually decrements
  // credits instead of failing payment_required. The buyer API key is a one-time
  // secret returned only on first creation; cache it on the profile below.
  let testCustomerApiKey: string | undefined;
  const publicClient =
    opts.publicClient ??
    new MeterPublicApiClient({ baseUrl, serviceId, serviceApiKey: apiKey, timeoutMs: 30_000 });
  try {
    const customer = await publicClient.upsertCustomer({
      customerLocalId: "cli-test",
      name: "cli-test",
      initialCredits: 1000,
    });
    testCustomerApiKey = customer.apiKey;
    io.out(`Created test customer "cli-test" with 1000 credits.`);
  } catch (error) {
    // A funded test customer is a convenience, not a prerequisite: an unreachable
    // server here must not abort a scaffold that has otherwise succeeded.
    const message = error instanceof Error ? error.message : String(error);
    io.err(
      `warning: could not create test customer: ${message}; run "meter customers grant cli-test 1000" later`
    );
  }

  // Scaffold: copy TS files verbatim, expand *.tmpl tokens.
  mkdirSync(join(targetDir, "src"), { recursive: true });
  const templates = templatesDir();
  cpSync(join(templates, "src", "server.ts"), join(targetDir, "src", "server.ts"));
  cpSync(join(templates, "tsconfig.json"), join(targetDir, "tsconfig.json"));
  const tokens: Record<string, string> = {
    __PROJECT_NAME__: name,
    __METER_BASE_URL__: baseUrl,
    __SERVICE_ID__: serviceId,
    __SERVICE_API_KEY__: apiKey,
  };
  const expand = (template: string) =>
    Object.entries(tokens).reduce((text, [token, value]) => text.replaceAll(token, value), template);
  const render = (from: string, to: string) =>
    writeFileSync(join(targetDir, to), expand(readFileSync(join(templates, from), "utf8")));
  render("package.json.tmpl", "package.json");
  render("env.tmpl", ".env");
  render("env.example.tmpl", ".env.example");
  render("gitignore.tmpl", ".gitignore");
  render("README.md.tmpl", "README.md");

  // Persist the service credentials as a profile named after the project.
  config.profiles[name] = {
    baseUrl,
    serviceId,
    apiKey,
    ...(testCustomerApiKey ? { testCustomerApiKey } : {}),
  };
  config.activeProfile = name;
  saveCliConfig(config, opts.configPath);

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
  io.out(`  npm run dev`);
  io.out(`  meter call echo --url http://localhost:8787/mcp --args '{"text":"hi"}'`);
  io.out(`  meter events tail`);
}
