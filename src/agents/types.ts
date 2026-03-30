import type { LlmDriver } from "../drivers/llm-driver.js";

export interface Agent {
  name: string;
  description: string;
  driver: LlmDriver;
}

export class AgentRegistry {
  private readonly byName = new Map<string, Agent>();

  constructor(agents: Agent[]) {
    for (const a of agents) {
      if (this.byName.has(a.name)) {
        throw new Error(`Duplicate agent in configuration: "${a.name}"`);
      }
      this.byName.set(a.name, a);
    }
  }

  get(name: string): Agent | undefined {
    return this.byName.get(name);
  }

  /** Stable list in insertion order. */
  all(): Agent[] {
    return [...this.byName.values()];
  }

  get size(): number {
    return this.byName.size;
  }
}
