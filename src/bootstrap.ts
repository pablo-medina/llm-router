import type { Logger } from "pino";
import {
  loadAppConfig,
  shouldRunAgentLlmHealthChecks,
} from "./config/load-config.js";
import { buildAgentRegistry } from "./agents/build-registry.js";
import { runAgentLlmHealthChecks } from "./agents/health.js";
import type { AppConfig } from "./config/types.js";
import type { AgentRegistry } from "./agents/types.js";

export interface BootstrapResult {
  config: AppConfig;
  agents: AgentRegistry;
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
  let agents = buildAgentRegistry(config);

  if (shouldRunAgentLlmHealthChecks(config)) {
    agents = await runAgentLlmHealthChecks(agents, log);
  }

  const port = resolveListenPort(config);
  return { config, agents, port };
}
