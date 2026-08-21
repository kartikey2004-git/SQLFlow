import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    // Sandbox/queue tests share one Postgres test DB and one pg-boss queue -
    // running files in parallel would race on the same rows/schemas.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 20000,
  },
});
