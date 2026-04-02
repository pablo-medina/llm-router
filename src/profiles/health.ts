import type { Logger } from "pino";
import type { Profile } from "./types.js";
import { ProfileRegistry } from "./types.js";

/**
 * Probes each profile's LLM. Profiles that fail the check are omitted from the
 * returned registry so the HTTP server can still start.
 */
export async function runProfileLlmHealthChecks(
  registry: ProfileRegistry,
  log: Logger,
): Promise<ProfileRegistry> {
  const healthy: Profile[] = [];
  for (const profile of registry.all()) {
    log.info(
      { profile: profile.name, driverId: profile.driver.id },
      "probing LLM (health check)",
    );
    try {
      await profile.driver.healthCheck();
      log.info({ profile: profile.name }, "LLM health check ok");
      healthy.push(profile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn(
        { profile: profile.name, err: msg },
        "LLM health check failed; profile will not be available",
      );
    }
  }
  return new ProfileRegistry(healthy);
}
