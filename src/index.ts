import { pino } from "pino";
import { createApp } from "./app.js";
import { bootstrap } from "./bootstrap.js";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

async function main() {
  const { port, agents } = await bootstrap(logger);
  const app = createApp(logger, { agentRegistry: agents });

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
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
