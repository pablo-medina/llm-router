import type { LlmDriver } from "../drivers/llm-driver.js";

export interface Profile {
  name: string;
  description: string;
  driver: LlmDriver;
}

export class ProfileRegistry {
  private readonly byName = new Map<string, Profile>();

  constructor(profiles: Profile[]) {
    for (const p of profiles) {
      if (this.byName.has(p.name)) {
        throw new Error(`Duplicate profile in configuration: "${p.name}"`);
      }
      this.byName.set(p.name, p);
    }
  }

  get(name: string): Profile | undefined {
    return this.byName.get(name);
  }

  /** Stable list in insertion order. */
  all(): Profile[] {
    return [...this.byName.values()];
  }

  get size(): number {
    return this.byName.size;
  }
}
