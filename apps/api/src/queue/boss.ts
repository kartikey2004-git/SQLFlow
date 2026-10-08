import { PgBoss } from "pg-boss";
import { logger } from "../utils/logger";

export const SANDBOX_QUEUE = "sandbox_jobs";

export const MAINTENANCE_QUEUE = "sandbox_maintenance";

let bossInstance: PgBoss | null = null;
let startPromise: Promise<PgBoss> | null = null;

export const getBoss = async (): Promise<PgBoss> => {
  if (bossInstance) return bossInstance;
  if (!startPromise) {
    startPromise = (async () => {
      const boss = new PgBoss({
        connectionString: process.env.POSTGRES_URL,
        schema: "pgboss",
        max: Number(process.env.PGBOSS_POOL_MAX ?? 4),
      });
      boss.on("error", (err: Error) => logger.error({ err }, "pg-boss error"));

      await boss.start();
      await boss.createQueue(SANDBOX_QUEUE, {
        policy: "singleton",
        retryLimit: 1,
        retryDelay: 1,
        expireInSeconds: 120,
      });
      await boss.createQueue(MAINTENANCE_QUEUE, {
        policy: "singleton",
        retryLimit: 0,
        expireInSeconds: 600,
      });

      bossInstance = boss;
      return boss;
    })();
  }
  return startPromise;
};

export const stopBoss = async (timeoutMs: number): Promise<void> => {
  if (!bossInstance) return;
  const boss = bossInstance;
  bossInstance = null;
  startPromise = null;
  await boss.stop({ graceful: true, timeout: timeoutMs });
};
