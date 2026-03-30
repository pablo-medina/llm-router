import { LlmDriver } from "../llm-driver.js";
import type { ChatRequest, ChatResponse, ChatRole } from "../types.js";

export interface OpenAiDriverConfig {
  /** API base URL, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  apiKey: string;
  /** Default model when the request omits `model`. */
  defaultModel?: string;
  /** Optional OpenAI-Organization header */
  organizationId?: string;
  /** Extra headers (e.g. providers that require additional keys). */
  headers?: Record<string, string>;
  /** Timeout in ms for the HTTP request. */
  timeoutMs?: number;
}

/** Normalize baseUrl: no trailing slash. */
function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * OpenAI driver: Chat Completions (`POST .../chat/completions`).
 */
export class OpenAiDriver extends LlmDriver {
  readonly id: string;
  private readonly config: OpenAiDriverConfig;
  private readonly base: string;
  private readonly timeoutMs: number;

  constructor(config: OpenAiDriverConfig, options?: { id?: string }) {
    super();
    this.config = config;
    this.base = normalizeBaseUrl(config.baseUrl);
    this.id = options?.id ?? "OpenAI";
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  /**
   * GET `/models` — lightweight and standard on OpenAI-compatible APIs.
   */
  override async healthCheck(): Promise<void> {
    const url = `${this.base}/models`;
    const timeoutMs = Math.min(this.timeoutMs, 15_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `GET /models failed (${res.status}): ${text.slice(0, 400)}`,
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }

  override async chat(request: ChatRequest): Promise<ChatResponse> {
    const model = request.model ?? this.config.defaultModel;
    if (!model) {
      throw new Error(
        "No model: set `model` on the request or `defaultModel` on the driver configuration.",
      );
    }

    const url = `${this.base}/chat/completions`;
    const body: Record<string, unknown> = {
      model,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
    if (request.extra) {
      for (const [k, v] of Object.entries(request.extra)) {
        if (!(k in body)) body[k] = v;
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      ...this.config.headers,
    };
    if (this.config.organizationId) {
      headers["OpenAI-Organization"] = this.config.organizationId;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `Non-JSON response from provider (${res.status}): ${text.slice(0, 500)}`,
      );
    }

    if (!res.ok) {
      const errMsg =
        typeof json === "object" && json !== null && "error" in json
          ? JSON.stringify((json as { error: unknown }).error)
          : text.slice(0, 500);
      throw new Error(`Chat completions failed (${res.status}): ${errMsg}`);
    }

    return mapOpenAiChatResponse(json);
  }
}

export function createOpenAiDriver(
  config: OpenAiDriverConfig,
  options?: { id?: string },
): OpenAiDriver {
  return new OpenAiDriver(config, options);
}

function mapOpenAiChatResponse(json: unknown): ChatResponse {
  const o = json as {
    id?: string;
    model?: string;
    choices?: Array<{
      index?: number;
      finish_reason?: string | null;
      message?: { role?: string; content?: string | null };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const choices =
    o.choices?.map((c, i) => {
      const roleRaw = c.message?.role;
      const content = c.message?.content ?? "";
      const role: ChatRole =
        roleRaw === "system" || roleRaw === "user" || roleRaw === "assistant"
          ? roleRaw
          : "assistant";
      return {
        index: c.index ?? i,
        message: {
          role,
          content: typeof content === "string" ? content : String(content),
        },
        finishReason: c.finish_reason ?? null,
      };
    }) ?? [];

  return {
    id: o.id,
    model: o.model,
    choices,
    usage: o.usage
      ? {
          promptTokens: o.usage.prompt_tokens,
          completionTokens: o.usage.completion_tokens,
          totalTokens: o.usage.total_tokens,
        }
      : undefined,
    raw: json,
  };
}
