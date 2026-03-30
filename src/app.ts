import cors from "cors";
import express from "express";
import type { IncomingMessage } from "node:http";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentRegistry } from "./agents/types.js";
import { createAgentRoutes } from "./routes/agent-routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const version = loadPackageVersion();

export interface CreateAppOptions {
  /** Agent registry (may be empty if there is no `ai.agents` in configuration). */
  agentRegistry: AgentRegistry;
}

export function createApp(logger: pino.Logger, options: CreateAppOptions) {
  const app = express();

  app.set("agentRegistry", options.agentRegistry);

  app.disable("x-powered-by");

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? true,
    }),
  );

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req: IncomingMessage) => req.url === "/health",
      },
    }),
  );

  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "llm-router",
      version,
    });
  });

  app.get("/", (_req, res) => {
    res.status(200).json({
      service: "llm-router",
      version,
    });
  });

  app.use("/api", createAgentRoutes(options.agentRegistry));

  return app;
}
