import cors from "cors";
import express from "express";
import type { IncomingMessage } from "node:http";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

export function createApp(logger: pino.Logger) {
  const app = express();

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

  return app;
}
