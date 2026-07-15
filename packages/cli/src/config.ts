import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type MeterProfile = {
  baseUrl: string;
  serviceId: string;
  apiKey: string;
  testCustomerApiKey?: string;
};

export type MeterCliConfig = {
  profiles: Record<string, MeterProfile>;
  activeProfile: string;
};

export type ResolvedConnection = MeterProfile & { profileName: string };

// Structurally equal to NodeJS.ProcessEnv, spelled out so the emitted .d.ts
// doesn't reference the global NodeJS namespace: consumers without
// @types/node in scope would otherwise fail to resolve it.
export type MeterCliEnv = Record<string, string | undefined>;

export class CliError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export function configPath(env: MeterCliEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(base, "meter", "config.json");
}

export function loadCliConfig(path: string = configPath()): MeterCliConfig {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<MeterCliConfig>;
    return {
      profiles: parsed.profiles ?? {},
      activeProfile: parsed.activeProfile ?? "default",
    };
  } catch {
    return { profiles: {}, activeProfile: "default" };
  }
}

export function saveCliConfig(config: MeterCliConfig, path: string = configPath()): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  // writeFileSync's mode only applies on create; enforce on overwrite too.
  chmodSync(path, 0o600);
}

export function resolveConnection(
  overrides: { profile?: string; baseUrl?: string; serviceId?: string; apiKey?: string },
  env: MeterCliEnv = process.env,
  config: MeterCliConfig = loadCliConfig()
): ResolvedConnection {
  const profileName = overrides.profile ?? config.activeProfile;
  const profile = config.profiles[profileName];
  const baseUrl = overrides.baseUrl ?? env.METER_BASE_URL ?? profile?.baseUrl;
  const serviceId = overrides.serviceId ?? env.METER_SERVICE_ID ?? profile?.serviceId;
  const apiKey = overrides.apiKey ?? env.METER_API_KEY ?? profile?.apiKey;
  if (!baseUrl || !serviceId || !apiKey) {
    throw new CliError(
      'not logged in: run "meter login" or set METER_BASE_URL / METER_SERVICE_ID / METER_API_KEY',
      2
    );
  }
  return { baseUrl, serviceId, apiKey, testCustomerApiKey: profile?.testCustomerApiKey, profileName };
}
