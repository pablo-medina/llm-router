import type { ChatRequest, ChatResponse } from "./types.js";

/**
 * Base contract for LLM drivers: each implementation talks to a concrete provider.
 */
export abstract class LlmDriver {
  abstract readonly id: string;

  /**
   * Sends a chat and returns the aggregated response (no streaming).
   */
  abstract chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Verifies connectivity and credentials with the provider (e.g. at bootstrap).
   */
  abstract healthCheck(): Promise<void>;
}
