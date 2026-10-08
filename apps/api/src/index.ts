import dotenv from "dotenv";
dotenv.config();

import { loadApiEnv } from "./config/env";

const env = loadApiEnv();

import { connectPostgres, pool } from "@sql-learn/database";
import { createApp } from "./app";
import { logger } from "./utils/logger";
import { stopBoss } from "./queue/boss";
import { closeAllStreams } from "./utils/sseRegistry";

const main = async () => {
  await connectPostgres();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API running on ${env.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");

    const force = setTimeout(() => {
      logger.error("Forced exit after shutdown timeout");
      process.exit(1);
    }, 9000);
    force.unref();

    try {
      server.close();
      closeAllStreams();
      server.closeIdleConnections?.();
      await stopBoss(8000);
      await pool.end();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

main().catch((err) => {
  logger.error({ err }, "Failed to start API");
  process.exit(1);
});
