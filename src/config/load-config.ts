import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { AiConfig, AppConfig } from "./types.js";

const DEFAULT_PORT = 9400;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function asString(x: unknown, path: string): string {
  if (typeof x !== "string" || x.trim() === "") {
    throw new Error(`Invalid configuration: expected string at ${path}`);
  }
  return x;
}

function asOptionalString(x: unknown): string | undefined {
  if (x === undefined || x === null) return undefined;
  if (typeof x !== "string") {
    throw new Error("Invalid configuration: expected optional string");
  }
  return x;
}

function parseAiDriver(raw: unknown, idx: number): import("./types.js").AiDriverConfig {
  if (!isRecord(raw)) {
    throw new Error(`ai.drivers[${idx}]: expected an object`);
  }
  return {
    name: asString(raw.name, `ai.drivers[${idx}].name`),
    url: asString(raw.url, `ai.drivers[${idx}].url`),
    apiKey: asOptionalString(raw.apiKey),
    envApiKey: asOptionalString(raw.envApiKey),
    defaultModel: asOptionalString(raw.defaultModel),
  };
}

function parseAiProfile(raw: unknown, idx: number): import("./types.js").AiProfileConfig {
  if (!isRecord(raw)) {
    throw new Error(`ai.profiles[${idx}]: expected an object`);
  }
  return {
    name: asString(raw.name, `ai.profiles[${idx}].name`),
    description: asString(raw.description, `ai.profiles[${idx}].description`),
    driver: asString(raw.driver, `ai.profiles[${idx}].driver`),
  };
}

function parseAi(raw: unknown): AiConfig {
  if (!isRecord(raw)) {
    throw new Error("ai: expected an object");
  }
  const driversRaw = raw.drivers;
  const profilesRaw = raw.profiles;

  if (driversRaw !== undefined && !Array.isArray(driversRaw)) {
    throw new Error("ai.drivers must be an array");
  }
  if (profilesRaw !== undefined && !Array.isArray(profilesRaw)) {
    throw new Error("ai.profiles must be an array");
  }

  const drivers = Array.isArray(driversRaw)
    ? driversRaw.map((d, i) => parseAiDriver(d, i))
    : [];
  const profiles =
    profilesRaw === undefined
      ? undefined
      : profilesRaw.map((p, i) => parseAiProfile(p, i));

  return { drivers, profiles };
}

function parseAppConfig(doc: unknown): AppConfig {
  if (!isRecord(doc)) {
    throw new Error("Root configuration must be an object");
  }

  let server = { port: DEFAULT_PORT };
  if (doc.server !== undefined) {
    if (!isRecord(doc.server)) {
      throw new Error("server: expected an object");
    }
    const port = doc.server.port;
    if (port !== undefined) {
      if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("server.port must be an integer between 1 and 65535");
      }
      server = { port };
    }
  }

  let ai: AiConfig | undefined;
  if (doc.ai !== undefined) {
    ai = parseAi(doc.ai);
  }

  return { server, ai };
}

function defaultConfig(): AppConfig {
  return { server: { port: DEFAULT_PORT } };
}

/**
 * Reads YAML from `LLM_ROUTER_CONFIG` or, by default, `./config/default.yaml`.
 * If the default file is missing and no path was forced, returns minimal configuration.
 */
export function loadAppConfig(): AppConfig {
  const defaultPath = join(process.cwd(), "config", "default.yaml");
  const path = process.env.LLM_ROUTER_CONFIG ?? defaultPath;

  if (!existsSync(path)) {
    if (process.env.LLM_ROUTER_CONFIG) {
      throw new Error(`Configuration file not found: ${path}`);
    }
    return defaultConfig();
  }

  const text = readFileSync(path, "utf8");
  const doc = parseYaml(text) as unknown;
  if (doc === undefined || doc === null) {
    return defaultConfig();
  }
  return parseAppConfig(doc);
}

/** Only when the `ai.profiles` key exists in YAML and has at least one profile. */
export function shouldRunProfileLlmHealthChecks(config: AppConfig): boolean {
  const profiles = config.ai?.profiles;
  return profiles !== undefined && profiles.length > 0;
}
