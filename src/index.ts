import pino from "pino";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 9400);

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

const app = createApp(logger);

const server = app.listen(port, () => {
  logger.info({ port }, "llm-router listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
