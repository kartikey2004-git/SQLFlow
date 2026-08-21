import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// Loaded explicitly (not the ambient `dotenv/config` used elsewhere in this
// package) because DATABASE_URL lives in packages/database/.env, next to
// the Prisma schema/config - and this module may be imported by processes
// whose CWD is elsewhere (apps/api, apps/api's worker), where a CWD-relative
// `dotenv/config` wouldn't find it. Existing values (e.g. from apps/api/.env,
// loaded earlier by the importing process) are never overwritten.
dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

/**
 * Prisma Client for the app-data tables (users, sessions, assignments,
 * test_cases, attempts, query_executions, submissions, evaluation_results,
 * hint_requests). Uses the standard node-postgres adapter over the pooled
 * Neon connection - this app runs as long-lived Node processes (not
 * edge/serverless), so the plain TCP `pg` adapter is correct here, not
 * `@prisma/adapter-neon` (that one's for HTTP/WebSocket-only runtimes).
 *
 * Deliberately separate from `pool`/`sandboxPool` (see index.ts): sandbox
 * provisioning/execution/cleanup stay on raw `pg` because they involve
 * dynamic DDL and role-switched connections Prisma can't express.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

export * from "./generated/prisma/client";
