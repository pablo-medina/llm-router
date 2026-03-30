/**
 * Prueba el driver OpenAI sin pasar por HTTP.
 *
 * Variables de entorno:
 * - LLM_DRIVER_BASE_URL — base del API (debe incluir /v1 si el proveedor lo usa así), p. ej. https://api.openai.com/v1
 * - LLM_DRIVER_API_KEY — API key
 * - LLM_DRIVER_MODEL — modelo (opcional si usás defaultModel vía LLM_DRIVER_DEFAULT_MODEL)
 * - LLM_DRIVER_DEFAULT_MODEL — modelo por defecto del driver
 * - LLM_DRIVER_ORG — OpenAI-Organization (opcional)
 * - LLM_DRIVER_PROMPT — texto del mensaje de usuario (default: saludo corto de prueba)
 */

import { createOpenAiDriver } from "../drivers/index.js";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v === "" ? undefined : v;
}

function requireEnv(name: string): string {
  const v = env(name);
  if (!v) {
    console.error(`Falta la variable de entorno ${name}.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const baseUrl = requireEnv("LLM_DRIVER_BASE_URL");
  const apiKey = requireEnv("LLM_DRIVER_API_KEY");

  const driver = createOpenAiDriver({
    baseUrl,
    apiKey,
    defaultModel: env("LLM_DRIVER_DEFAULT_MODEL"),
    organizationId: env("LLM_DRIVER_ORG"),
  });

  const model = env("LLM_DRIVER_MODEL");
  const prompt =
    env("LLM_DRIVER_PROMPT") ??
    "Respondé en una sola frase: confirmá que el driver funciona.";

  console.error(`Driver: ${driver.id}`);
  console.error(`POST ${baseUrl.replace(/\/+$/, "")}/chat/completions`);

  const response = await driver.chat({
    messages: [{ role: "user", content: prompt }],
    ...(model ? { model } : {}),
    temperature: 0.3,
  });

  const text = response.choices[0]?.message.content ?? "";
  console.log(text);

  if (response.usage) {
    console.error(
      JSON.stringify({ usage: response.usage, model: response.model ?? model }),
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
