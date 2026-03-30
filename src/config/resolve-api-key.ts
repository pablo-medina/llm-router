import type { AiDriverConfig } from "./types.js";

export function resolveDriverApiKey(
  driver: AiDriverConfig,
  context: string,
): string {
  const inline = driver.apiKey?.trim();
  const envName = driver.envApiKey?.trim();

  const hasInline = inline !== undefined && inline.length > 0;
  const hasEnvName = envName !== undefined && envName.length > 0;

  if (hasInline && hasEnvName) {
    throw new Error(
      `${context}: use only apiKey or envApiKey on driver "${driver.name}", not both.`,
    );
  }
  if (hasInline) {
    return inline!;
  }
  if (hasEnvName) {
    const v = process.env[envName!];
    if (v === undefined || v === "") {
      throw new Error(
        `${context}: environment variable "${envName}" is not defined or is empty (driver "${driver.name}").`,
      );
    }
    return v;
  }
  throw new Error(
    `${context}: driver "${driver.name}" requires apiKey or envApiKey.`,
  );
}
