import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.TEST_DATABASE_URL || !process.env.TEST_SANDBOX_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL and TEST_SANDBOX_DATABASE_URL must be set in apps/api/.env " +
      "(a separate database from dev - see .env.example). Run `bun run migrate:test` against it first.",
  );
}

// Redirect the app's own env vars at the test database *before* any app
// module (which reads these at import time) gets imported by a test file.
process.env.POSTGRES_URL = process.env.TEST_DATABASE_URL;
process.env.SANDBOX_DATABASE_URL = process.env.TEST_SANDBOX_DATABASE_URL;
// @sql-learn/database's Prisma client reads DATABASE_URL from
// packages/database/.env independently of the two lines above (its own
// dotenv.config() call never overwrites an already-set env var) - without
// this, Better Auth (which writes users/sessions/accounts exclusively
// through Prisma) would create rows in the real dev database instead of
// the test one, while every other repository's raw `pool` queries (FK'd to
// those same users) correctly hit TEST_DATABASE_URL, causing cross-database
// foreign key violations.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.CLEANUP_TOKEN ||= "test-cleanup-token";
process.env.CORS_ORIGIN ||= "http://localhost:3000";
