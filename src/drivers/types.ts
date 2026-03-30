/**
 * Tipos comunes para requests/responses de chat entre drivers y el router.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Si no se indica, el driver puede usar un modelo por defecto de su configuración. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Parámetros extra que el proveedor acepte (p. ej. top_p, stream en el futuro). */
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
