import pkg from "pg";
import "dotenv/config";
import { logger } from "./logger";

export * from "./prisma";

const { Pool, types } = pkg;

// node-postgres returns bigint (OID 20 - our bigserial PKs/FKs) as strings by
// default, to avoid silently losing precision above Number.MAX_SAFE_INTEGER.
// This app's row counts/IDs never approach that range, and returning them as
// strings would otherwise leak into every repository type and API response
// (and into student query results - e.g. COUNT(*) is bigint too). Registered
// once, globally, since node-postgres's type parser table is module-level.
// NOTE: this does NOT affect `prisma.ts` - Prisma decodes BigInt-typed
// columns as native JS `bigint` itself, independent of `pg`'s type-parser
// table, even when using @prisma/adapter-pg. Prisma-based repositories
// convert bigint id/FK fields to `number` explicitly at their return
// boundary instead (same rationale, applied locally per repository).
types.setTypeParser(20, (value: string) => parseInt(value, 10));

/** Admin/provisioning pool - full privileges within the app database. */
export const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

/**
 * Low-privilege pool used exclusively to run student-submitted SQL, as the
 * `sandbox_runner` role (see migrations/1700000000002_sandbox_runner_role.cjs).
 * Never used for provisioning/DDL/admin reads - kept as a separate pool so a
 * bug can't accidentally run student SQL through the admin credentials.
 */
export const sandboxPool = new Pool({
  connectionString: process.env.SANDBOX_DATABASE_URL,
  max: 10,
});

// An idle client emitting an error (e.g. the network drops) crashes the
// process by default with an unhandled 'error' event - both pools need a
// listener even though we don't do anything beyond logging it.
pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle admin Postgres client");
});
sandboxPool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle sandbox Postgres client");
});

export const connectPostgres = async () => {
  const client = await pool.connect();
  client.release();
  logger.info("Postgres connected");
};
