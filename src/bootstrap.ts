import type { Logger } from "pino";
import {
  loadAppConfig,
  shouldRunProfileLlmHealthChecks,
} from "./config/load-config.js";
import { buildProfileRegistry } from "./profiles/build-registry.js";
import { runProfileLlmHealthChecks } from "./profiles/health.js";
import type { AppConfig } from "./config/types.js";
import type { ProfileRegistry } from "./profiles/types.js";

export interface BootstrapResult {
  config: AppConfig;
  profiles: ProfileRegistry;
  port: number;
}

function resolveListenPort(config: AppConfig): number {
  const fromEnv = process.env.PORT;
  if (fromEnv !== undefined && fromEnv !== "") {
    const n = Number(fromEnv);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      throw new Error(`Invalid PORT: ${fromEnv}`);
    }
    return n;
  }
  return config.server.port;
}

export async function bootstrap(log: Logger): Promise<BootstrapResult> {
  const config = loadAppConfig();
  let profiles = buildProfileRegistry(config);

  if (shouldRunProfileLlmHealthChecks(config)) {
    profiles = await runProfileLlmHealthChecks(profiles, log);
  }

  const port = resolveListenPort(config);
  return { config, profiles, port };
}
