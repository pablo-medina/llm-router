import cors from "cors";
import express from "express";
import type { IncomingMessage } from "node:http";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProfileRegistry } from "./profiles/types.js";
import { createProfileRoutes } from "./routes/profile-routes.js";

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
  /** Profile registry (may be empty if there is no `ai.profiles` in configuration). */
  profileRegistry: ProfileRegistry;
}

export function createApp(logger: Logger, options: CreateAppOptions) {
  const app = express();

  app.set("profileRegistry", options.profileRegistry);

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

  app.use("/api", createProfileRoutes(options.profileRegistry));

  return app;
}
