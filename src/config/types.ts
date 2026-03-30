export interface ServerConfig {
  port: number;
}

export interface AiDriverConfig {
  name: string;
  url: string;
  /** Plaintext key (controlled environments only). */
  apiKey?: string;
  /** Environment variable name that holds the API key. */
  envApiKey?: string;
  /** Only for `openai` driver: default model when requests omit `model`. */
  defaultModel?: string;
}

export interface AiAgentConfig {
  name: string;
  description: string;
  /** Must match `ai.drivers[].name`. */
  driver: string;
}

export interface AiConfig {
  drivers: AiDriverConfig[];
  /** If the key is missing in YAML, LLM health checks are not run at bootstrap. */
  agents?: AiAgentConfig[];
}

export interface AppConfig {
  server: ServerConfig;
  ai?: AiConfig;
}
