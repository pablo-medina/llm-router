import type { AppConfig } from "../config/types.js";
import { resolveDriverApiKey } from "../config/resolve-api-key.js";
import { OpenAiDriver } from "../drivers/openai/openai-driver.js";
import type { LlmDriver } from "../drivers/llm-driver.js";
import { ProfileRegistry, type Profile } from "./types.js";

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
 * Validates uniqueness, resolves API keys, and builds the profile registry with drivers.
 */
export function buildProfileRegistry(config: AppConfig): ProfileRegistry {
  const driversYaml = config.ai?.drivers ?? [];
  const profilesYaml = config.ai?.profiles ?? [];

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

  const seenProfileNames = new Set<string>();
  const profiles: Profile[] = [];

  for (const p of profilesYaml) {
    const n = p.name.trim();
    if (seenProfileNames.has(n)) {
      throw new Error(`ai.profiles: duplicate name "${p.name}"`);
    }
    seenProfileNames.add(n);

    const driverName = p.driver.trim().toLowerCase();
    const driver = driverByName.get(driverName);
    if (!driver) {
      throw new Error(
        `Profile "${p.name}": no driver named "${driverName}" exists in ai.drivers.`,
      );
    }

    profiles.push({
      name: n,
      description: p.description,
      driver,
    });
  }

  return new ProfileRegistry(profiles);
}
