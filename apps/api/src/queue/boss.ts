import { PgBoss } from "pg-boss";
import { logger } from "../utils/logger";

// Single queue carrying both job types (execute_query/evaluate_submission,
// see queue/types.ts) - keeps job-status lookups (GET /sandbox/jobs/:id) to
// one queue name instead of having the caller track which queue a job is in.
export const SANDBOX_QUEUE = "sandbox_jobs";

let bossInstance: PgBoss | null = null;
let startPromise: Promise<PgBoss> | null = null;

/**
 * Lazily starts a single shared PgBoss instance (own `pgboss` schema in the
 * same Postgres database - Postgres-native queue, no Redis). Both the API
 * process (to send jobs) and the worker process (to send + work jobs) call
 * this; each process gets its own instance since PgBoss isn't a singleton
 * across processes, but within a process this avoids starting it twice.
 */
export const getBoss = async (): Promise<PgBoss> => {
  if (bossInstance) return bossInstance;
  if (!startPromise) {
    startPromise = (async () => {
      const boss = new PgBoss({
        connectionString: process.env.POSTGRES_URL,
        schema: "pgboss",
      });
      boss.on("error", (err: Error) => logger.error({ err }, "pg-boss error"));

      await boss.start();
      await boss.createQueue(SANDBOX_QUEUE, {
        // At most one *active* job per singletonKey (we key by user) - a
        // student can't have two query executions running concurrently,
        // without blocking them from queueing a second request that runs
        // once the first completes.
        policy: "singleton",
        retryLimit: 1,
        retryDelay: 1,
        expireInSeconds: 30,
      });

      bossInstance = boss;
      return boss;
    })();
  }
  return startPromise;
};
