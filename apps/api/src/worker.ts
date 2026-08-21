import "dotenv/config";
import { createServer } from "http";
import { connectPostgres } from "@sql-learn/database";
import { getBoss, SANDBOX_QUEUE } from "./queue/boss";
import type { SandboxJobPayload, SandboxJobOutput } from "./queue/types";
import { ExecutionService, ExecutionServiceError } from "./services/sandbox/execution.service";
import { GradingService } from "./services/grading/grading.service";
import { ApiError } from "./utils/ApiError";
import { logger } from "./utils/logger";
import { registry } from "./utils/metrics";
import type { Job } from "pg-boss";

const STATUS_BY_EXECUTION_ERROR: Record<string, number> = {
  VALIDATION_ERROR: 400,
  SANDBOX_NOT_FOUND: 404,
  TIMEOUT: 408,
  PERMISSION_ERROR: 403,
  SYNTAX_ERROR: 400,
  RUNTIME_ERROR: 400,
};

const run = async () => {
  await connectPostgres();
  const boss = await getBoss();

  // localConcurrency = number of jobs this worker process handles in
  // parallel (pg-boss v12 API - see node_modules/pg-boss/dist/types.d.ts,
  // WorkConcurrencyOptions). Configurable per prompt.md §17 rather than
  // hardcoded, since the right value depends on the deployment's DB
  // connection budget (sandboxPool caps at 10 - see packages/database).
  const localConcurrency = Number(process.env.WORKER_CONCURRENCY ?? 4);

  await boss.work<SandboxJobPayload, SandboxJobOutput>(
    SANDBOX_QUEUE,
    { batchSize: 1, localConcurrency },
    async ([job]: Job<SandboxJobPayload>[]) => {
      const { type, userId, assignmentId, query } = job!.data;
      const jobId = job!.id;

      try {
        if (type === "execute_query") {
          const result = await ExecutionService.executeQuery(userId, assignmentId, query, jobId);
          return { result };
        }
        const result = await GradingService.gradeSubmission(userId, assignmentId, query, jobId);
        return { result };
      } catch (error) {
        // Expected outcomes (bad SQL, sandbox not found, grading 4xxs) become
        // a completed job carrying an error payload - not a pg-boss "failed"
        // job, which is reserved for unexpected/infra failures worth
        // retrying and alerting on.
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

  logger.info(`Worker started, listening on queue "${SANDBOX_QUEUE}"`);

  // Query-execution metrics (duration, timeout count) are recorded in this
  // process, not the API process - exposed here so Prometheus scrapes the
  // worker as its own target rather than losing that data.
  const metricsPort = Number(process.env.WORKER_METRICS_PORT ?? 5001);
  createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.setHeader("Content-Type", registry.contentType);
      res.end(await registry.metrics());
      return;
    }
    if (req.url === "/health") {
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.statusCode = 404;
    res.end();
  }).listen(metricsPort, () => {
    logger.info(`Worker metrics server listening on ${metricsPort}`);
  });
};

run().catch((error) => {
  logger.error({ err: error }, "Worker failed to start");
  process.exit(1);
});
