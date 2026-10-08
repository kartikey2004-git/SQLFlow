import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.TEST_DATABASE_URL || !process.env.TEST_SANDBOX_ADMIN_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL and TEST_SANDBOX_ADMIN_DATABASE_URL must be set (env or apps/api/.env) " +
      "(a separate database from dev - see .env.example). Run `bun run migrate:test` against it first.",
  );
}

process.env.POSTGRES_URL = process.env.TEST_DATABASE_URL;
process.env.SANDBOX_ADMIN_DATABASE_URL = process.env.TEST_SANDBOX_ADMIN_DATABASE_URL;
process.env.SANDBOX_ROLE_SECRET ||= "test-sandbox-role-secret-0123456789";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.CLEANUP_TOKEN ||= "test-cleanup-token";
process.env.CORS_ORIGIN ||= "http://localhost:3000";
