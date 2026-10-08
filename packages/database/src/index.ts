import pkg from "pg";
import "dotenv/config";
import { logger } from "./logger";

export * from "./prisma";

const { Pool, types } = pkg;

types.setTypeParser(20, (value: string) => parseInt(value, 10));

export const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: Number(process.env.POSTGRES_POOL_MAX ?? 5),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle admin Postgres client");
});

export const connectPostgres = async () => {
  const client = await pool.connect();
  client.release();
  logger.info("Postgres connected");
};
