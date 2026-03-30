import type { ChatRequest, ChatResponse } from "./types.js";

/**
 * Contrato base para drivers LLM: cada implementación habla con un proveedor concreto.
 */
export abstract class LlmDriver {
  abstract readonly id: string;

  /**
   * Envía un chat y devuelve la respuesta agregada (no streaming).
   */
  abstract chat(request: ChatRequest): Promise<ChatResponse>;
}
