import type { Logger } from "pino";
import type { Agent } from "./types.js";
import { AgentRegistry } from "./types.js";

/**
 * Probes each agent's LLM. Agents that fail the check are omitted from the
 * returned registry so the HTTP server can still start.
 */
export async function runAgentLlmHealthChecks(
  registry: AgentRegistry,
  log: Logger,
): Promise<AgentRegistry> {
  const healthy: Agent[] = [];
  for (const agent of registry.all()) {
    log.info(
      { agent: agent.name, driverId: agent.driver.id },
      "probing LLM (health check)",
    );
    try {
      await agent.driver.healthCheck();
      log.info({ agent: agent.name }, "LLM health check ok");
      healthy.push(agent);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn(
        { agent: agent.name, err: msg },
        "LLM health check failed; agent will not be available",
      );
    }
  }
  return new AgentRegistry(healthy);
}
