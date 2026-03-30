import type { Logger } from "pino";
import type { AgentRegistry } from "./types.js";

export async function runAgentLlmHealthChecks(
  registry: AgentRegistry,
  log: Logger,
): Promise<void> {
  for (const agent of registry.all()) {
    log.info(
      { agent: agent.name, driverId: agent.driver.id },
      "probing LLM (health check)",
    );
    await agent.driver.healthCheck();
    log.info({ agent: agent.name }, "LLM health check ok");
  }
}
