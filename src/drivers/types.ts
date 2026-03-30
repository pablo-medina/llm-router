/**
 * Common types for chat requests/responses between drivers and the router.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** When omitted, the driver may use a default model from its configuration. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Extra parameters the provider accepts (e.g. top_p, stream in the future). */
  extra?: Record<string, unknown>;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finishReason?: string | null;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatResponse {
  id?: string;
  model?: string;
  choices: ChatChoice[];
  usage?: TokenUsage;
  raw?: unknown;
}
