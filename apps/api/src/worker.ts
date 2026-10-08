import "dotenv/config";
import { createServer } from "http";
import { connectPostgres, pool } from "@sql-learn/database";
import { loadWorkerEnv } from "./config/env";
import { getBoss, stopBoss, SANDBOX_QUEUE, MAINTENANCE_QUEUE } from "./queue/boss";
import type { SandboxJobPayload, SandboxJobOutput, MaintenanceJobPayload } from "./queue/types";
import { ExecutionService, ExecutionServiceError } from "./services/sandbox/execution.service";
import { SandboxService } from "./services/sandbox/sandbox.service";
import { MaintenanceService } from "./services/sandbox/maintenance.service";
import { closeSandboxAdminPool } from "./services/sandbox/sandboxDb";
import { GradingService } from "./services/grading/grading.service";
import { ApiError } from "./utils/ApiError";
import { logger } from "./utils/logger";
import { registry } from "./utils/metrics";
import type { Job } from "pg-boss";

const STATUS_BY_EXECUTION_ERROR: Record<string, number> = {
  SANDBOX_NOT_FOUND: 404,
  QUOTA_EXCEEDED: 413,
};

const run = async () => {
  const env = loadWorkerEnv();
  await connectPostgres();
  await SandboxService.hardenInstance();
  const boss = await getBoss();

  const localConcurrency = env.WORKER_CONCURRENCY;

  await boss.work<SandboxJobPayload, SandboxJobOutput>(
    SANDBOX_QUEUE,
    { batchSize: 1, localConcurrency },
    async ([job]: Job<SandboxJobPayload>[]) => {
      const { type, userId, assignmentId, query } = job!.data;
      const jobId = job!.id;

      try {
        switch (type) {
          case "execute_query":
            return { result: await ExecutionService.executeQuery(userId, assignmentId, query, jobId) };
          case "evaluate_submission":
            return { result: await GradingService.gradeSubmission(userId, assignmentId, query, jobId) };
          case "init_sandbox": {
            const { created } = await SandboxService.initSandbox(userId, assignmentId);
            return { result: { sandboxReady: true as const, created } };
          }
          case "reset_sandbox": {
            const { created } = await SandboxService.resetSandbox(userId, assignmentId);
            return { result: { sandboxReady: true as const, created } };
          }
          default:
            return { error: { type: "UNKNOWN_JOB", message: `Unknown job type ${String(type)}`, statusCode: 400 } };
        }
      } catch (error) {
        if (error instanceof ExecutionServiceError) {
          return {
            error: {
              type: error.type,
              message: error.message,
              statusCode: STATUS_BY_EXECUTION_ERROR[error.type] ?? 500,
            },
          };
        }
        if (error instanceof ApiError) {
          return { error: { type: "API_ERROR", message: error.message, statusCode: error.statusCode } };
        }
        throw error;
      }
    },
  );

  await boss.work<MaintenanceJobPayload>(MAINTENANCE_QUEUE, { batchSize: 1 }, async ([job]) => {
    const result = await MaintenanceService.run(job!.data.daysToKeep);
    return result;
  });

  logger.info(`Worker started, listening on queues "${SANDBOX_QUEUE}", "${MAINTENANCE_QUEUE}"`);

  let shuttingDown = false;
  const port = env.PORT ?? Number(process.env.WORKER_METRICS_PORT ?? 5001);
  const server = createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.setHeader("Content-Type", registry.contentType);
      res.end(await registry.metrics());
      return;
    }
    if (req.url === "/health" || req.url === "/livez") {
      res.statusCode = shuttingDown ? 503 : 200;
      res.end(JSON.stringify({ ok: !shuttingDown }));
      return;
    }
    res.statusCode = 404;
    res.end();
  }).listen(port, () => logger.info(`Worker HTTP server listening on ${port}`));

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Worker shutting down");
    const force = setTimeout(() => process.exit(1), 25_000);
    force.unref();
    try {
      server.close();
      await stopBoss(20_000);
      await pool.end();
      await closeSandboxAdminPool();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during worker shutdown");
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "Unhandled rejection in worker"));

run().catch((error) => {
  logger.error({ err: error }, "Worker failed to start");
  process.exit(1);
});
