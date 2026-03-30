import type { AppConfig } from "../config/types.js";
import { resolveDriverApiKey } from "../config/resolve-api-key.js";
import { OpenAiDriver } from "../drivers/openai/openai-driver.js";
import type { LlmDriver } from "../drivers/llm-driver.js";
import { AgentRegistry, type Agent } from "./types.js";

function createDriverInstance(
  def: import("../config/types.js").AiDriverConfig,
): LlmDriver {
  const nameLower = def.name.trim().toLowerCase();
  const apiKey = resolveDriverApiKey(def, "drivers");

  if (nameLower === "openai") {
    return new OpenAiDriver(
      {
        baseUrl: def.url,
        apiKey,
        defaultModel: def.defaultModel,
      },
      { id: def.name },
    );
  }

  throw new Error(
    `Unsupported driver: "${def.name}". Implemented: openai.`,
  );
}

/**
 * Validates uniqueness, resolves API keys, and builds the agent registry with drivers.
 */
export function buildAgentRegistry(config: AppConfig): AgentRegistry {
  const driversYaml = config.ai?.drivers ?? [];
  const agentsYaml = config.ai?.agents ?? [];

  const driverByName = new Map<string, LlmDriver>();
  const seenDriverNames = new Set<string>();

  for (const d of driversYaml) {
    const key = d.name.trim().toLowerCase();
    if (seenDriverNames.has(key)) {
      throw new Error(`ai.drivers: duplicate name "${d.name}"`);
    }
    seenDriverNames.add(key);
    driverByName.set(key, createDriverInstance(d));
  }

  const seenAgentNames = new Set<string>();
  const agents: Agent[] = [];

  for (const a of agentsYaml) {
    const n = a.name.trim();
    if (seenAgentNames.has(n)) {
      throw new Error(`ai.agents: duplicate name "${a.name}"`);
    }
    seenAgentNames.add(n);

    const driverName = a.driver.trim().toLowerCase();
    const driver = driverByName.get(driverName);
    if (!driver) {
      throw new Error(
        `Agent "${a.name}": no driver named "${driverName}" exists in ai.drivers.`,
      );
    }

    agents.push({
      name: n,
      description: a.description,
      driver,
    });
  }

  return new AgentRegistry(agents);
}
