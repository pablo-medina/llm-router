import { Router, type Request, type Response } from "express";
import type { AgentRegistry } from "../agents/types.js";
import type {
  ChatContentPart,
  ChatMessage,
  ChatMessageContent,
  ChatRequest,
  ChatResponse,
  ChatRole,
} from "../drivers/types.js";

const CHAT_ROLES: ChatRole[] = ["system", "user", "assistant"];

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ error: message });
}

function notFound(res: Response, message: string): void {
  res.status(404).json({ error: message });
}

function parseContentPart(raw: unknown, path: string): ChatContentPart {
  if (!isRecord(raw)) {
    throw new Error(`Invalid content part at ${path}`);
  }
  const type = raw.type;
  if (type === "text") {
    const text = raw.text;
    if (typeof text !== "string") {
      throw new Error(`Invalid text at ${path}`);
    }
    return { type: "text", text };
  }
  if (type === "image_url") {
    const imageUrl = raw.image_url;
    if (!isRecord(imageUrl)) {
      throw new Error(`Invalid image_url at ${path}`);
    }
    const url = imageUrl.url;
    if (typeof url !== "string" || url.trim() === "") {
      throw new Error(`Invalid image_url.url at ${path}`);
    }
    const detail = imageUrl.detail;
    if (
      detail !== undefined &&
      detail !== "low" &&
      detail !== "high" &&
      detail !== "auto"
    ) {
      throw new Error(`Invalid image_url.detail at ${path}`);
    }
    return {
      type: "image_url",
      image_url:
        detail === undefined
          ? { url }
          : { url, detail },
    };
  }
  throw new Error(`Unsupported content part type at ${path}`);
}

function parseMessageContent(raw: unknown, path: string): ChatMessageContent {
  if (typeof raw === "string") return raw;
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid message content at ${path}`);
  }
  return raw.map((p, i) => parseContentPart(p, `${path}[${i}]`));
}

function parseChatMessage(raw: unknown, idx: number): ChatMessage {
  if (!isRecord(raw)) {
    throw new Error(`Invalid message at messages[${idx}]`);
  }
  const role = raw.role;
  if (typeof role !== "string" || !CHAT_ROLES.includes(role as ChatRole)) {
    throw new Error(`Invalid role at messages[${idx}]`);
  }
  return {
    role: role as ChatRole,
    content: parseMessageContent(raw.content, `messages[${idx}].content`),
  };
}

/**
 * Response shape for clients: no provider `raw` payload, no driver or credential fields.
 */
function contentToPublicString(content: ChatMessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function toPublicChatResponse(r: ChatResponse) {
  return {
    id: r.id,
    model: r.model,
    choices: r.choices.map((c) => ({
      index: c.index,
      message: {
        role: c.message.role,
        content: contentToPublicString(c.message.content),
      },
      finishReason: c.finishReason ?? null,
    })),
    usage: r.usage,
  };
}

function readJsonBody(req: Request): unknown {
  return req.body;
}

export function createAgentRoutes(registry: AgentRegistry): Router {
  const router = Router();

  router.get("/agents", (_req: Request, res: Response) => {
    res.json({
      agents: registry.all().map((a) => ({
        name: a.name,
        description: a.description,
      })),
    });
  });

  router.post(
    "/agents/:agentName/chat",
    async (req: Request, res: Response) => {
      const agentName = req.params.agentName?.trim();
      if (!agentName) {
        badRequest(res, "Missing agent name.");
        return;
      }

      const agent = registry.get(agentName);
      if (!agent) {
        notFound(res, `Unknown agent: "${agentName}".`);
        return;
      }

      const body = readJsonBody(req);
      if (!isRecord(body)) {
        badRequest(res, "JSON body must be an object.");
        return;
      }

      let messages: ChatMessage[];
      try {
        const prompt = body.prompt;
        const messagesRaw = body.messages;

        if (messagesRaw !== undefined) {
          if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
            throw new Error("`messages` must be a non-empty array.");
          }
          messages = messagesRaw.map((m, i) => parseChatMessage(m, i));
        } else if (typeof prompt === "string" && prompt.trim() !== "") {
          messages = [{ role: "user", content: prompt.trim() }];
        } else {
          throw new Error("Provide `prompt` (string) or non-empty `messages`.");
        }
      } catch (e) {
        badRequest(
          res,
          e instanceof Error ? e.message : "Invalid request body.",
        );
        return;
      }

      const model =
        typeof body.model === "string" && body.model.trim() !== ""
          ? body.model.trim()
          : undefined;
      const temperature =
        typeof body.temperature === "number" ? body.temperature : undefined;
      const maxTokens =
        typeof body.maxTokens === "number" ? body.maxTokens : undefined;

      const chatRequest: ChatRequest = {
        messages,
        ...(model ? { model } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxTokens !== undefined ? { maxTokens } : {}),
      };

      try {
        const out = await agent.driver.chat(chatRequest);
        res.status(200).json(toPublicChatResponse(out));
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "The chat request could not be completed.";
        res.status(502).json({ error: msg });
      }
    },
  );

  router.post(
    "/agents/:agentName/analyze-images",
    async (req: Request, res: Response) => {
      const agentName = req.params.agentName?.trim();
      if (!agentName) {
        badRequest(res, "Missing agent name.");
        return;
      }

      const agent = registry.get(agentName);
      if (!agent) {
        notFound(res, `Unknown agent: "${agentName}".`);
        return;
      }

      const body = readJsonBody(req);
      if (!isRecord(body)) {
        badRequest(res, "JSON body must be an object.");
        return;
      }

      const prompt =
        typeof body.prompt === "string" && body.prompt.trim() !== ""
          ? body.prompt.trim()
          : "Describe the image(s).";

      const imagesRaw = body.images;
      if (!Array.isArray(imagesRaw) || imagesRaw.length === 0) {
        badRequest(res, "`images` must be a non-empty array.");
        return;
      }

      const parts: ChatContentPart[] = [{ type: "text", text: prompt }];

      try {
        for (let i = 0; i < imagesRaw.length; i++) {
          const img = imagesRaw[i];
          if (!isRecord(img)) {
            throw new Error(`Invalid images[${i}].`);
          }
          if (typeof img.url === "string" && img.url.trim() !== "") {
            parts.push({
              type: "image_url",
              image_url: { url: img.url.trim() },
            });
            continue;
          }
          const b64 = img.base64;
          if (typeof b64 === "string" && b64.trim() !== "") {
            const mime =
              typeof img.mimeType === "string" && img.mimeType.trim() !== ""
                ? img.mimeType.trim()
                : "image/jpeg";
            parts.push({
              type: "image_url",
              image_url: { url: `data:${mime};base64,${b64.trim()}` },
            });
            continue;
          }
          throw new Error(
            `images[${i}]: provide \"url\" (string) or \"base64\" (string), optional mimeType.`,
          );
        }
      } catch (e) {
        badRequest(
          res,
          e instanceof Error ? e.message : "Invalid images payload.",
        );
        return;
      }

      const chatRequest: ChatRequest = {
        messages: [{ role: "user", content: parts }],
      };

      if (typeof body.model === "string" && body.model.trim() !== "") {
        chatRequest.model = body.model.trim();
      }
      if (typeof body.temperature === "number") {
        chatRequest.temperature = body.temperature;
      }
      if (typeof body.maxTokens === "number") {
        chatRequest.maxTokens = body.maxTokens;
      }

      try {
        const out = await agent.driver.chat(chatRequest);
        res.status(200).json(toPublicChatResponse(out));
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "The chat request could not be completed.";
        res.status(502).json({ error: msg });
      }
    },
  );

  return router;
}
