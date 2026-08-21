import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pkg from "pg";
import { pool } from "@sql-learn/database";
import { createTestUser, cleanupTestData } from "../helpers/fixtures";
import { SandboxService } from "../../src/services/sandbox/sandbox.service";

const { Client } = pkg;
const adminPool = pool;

/**
 * Named adversarial regression suite for the sandbox execution boundary.
 * Per infra-observability-testing.md, a regression here is a security
 * incident, not a bug ticket - this connects directly as `sandbox_runner`
 * (the same role student queries run as) and proves the *database* refuses
 * privileged/cross-tenant operations, independent of the AST validator layer
 * (which is tested separately in tests/unit/validation.test.ts). Both layers
 * must independently hold.
 */
describe("Sandbox security boundary (sandbox_runner role)", () => {
  let userAId: number;
  let userBId: number;
  let schemaA: string;
  let schemaB: string;

  beforeAll(async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    userAId = userA.user.id;
    userBId = userB.user.id;

    const assignmentResult = await adminPool.query<{ id: number }>(
      `INSERT INTO assignments (title, question, difficulty, sample_tables)
       VALUES ('Test Assignment sec-suite', 'x', 'easy', $1)
       RETURNING id`,
      [JSON.stringify([{ tableName: "secrets", columns: [{ columnName: "id", dataType: "INTEGER" }], rows: [{ id: 1 }] }])],
    );
    const assignmentId = assignmentResult.rows[0]!.id;

    schemaA = (await SandboxService.initSandbox(userAId, assignmentId)).schemaName;
    schemaB = (await SandboxService.initSandbox(userBId, assignmentId)).schemaName;
  });

  afterAll(cleanupTestData);

  const connectAsSandboxRunner = async () => {
    const client = new Client({ connectionString: process.env.SANDBOX_DATABASE_URL });
    await client.connect();
    return client;
  };

  /**
   * Activates `userId`'s own per-user role (see SandboxService.
   * ensureUserRole / ExecutionService.executeQuery) - the same `SET ROLE` a
   * real query execution performs, so tests that exercise DDL/DML rejection
   * or resource limits do so against a session with legitimate schema
   * access, not one that's simply denied everything for the wrong reason.
   */
  const asUser = async (client: InstanceType<typeof Client>, userId: number) => {
    await client.query(`SET LOCAL ROLE "${SandboxService.sandboxUserRole(userId)}"`);
  };

  it("rejects DROP TABLE", async () => {
    const client = await connectAsSandboxRunner();
    try {
      await client.query("BEGIN");
      await asUser(client, userAId);
      await expect(client.query(`DROP TABLE "${schemaA}"."secrets"`)).rejects.toThrow(/read-only/i);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }
  });

  it("rejects ALTER TABLE", async () => {
    const client = await connectAsSandboxRunner();
    try {
      await client.query("BEGIN");
      await asUser(client, userAId);
      await expect(
        client.query(`ALTER TABLE "${schemaA}"."secrets" ADD COLUMN hacked text`),
      ).rejects.toThrow(/read-only/i);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }
  });

  it("rejects CREATE EXTENSION", async () => {
    const client = await connectAsSandboxRunner();
    try {
      await expect(client.query(`CREATE EXTENSION IF NOT EXISTS dblink`)).rejects.toThrow(/read-only/i);
    } finally {
      await client.end();
    }
  });

  it("rejects INSERT/UPDATE/DELETE", async () => {
    const client = await connectAsSandboxRunner();
    try {
      // A rejected statement aborts the rest of its transaction in Postgres
      // (subsequent statements fail with "current transaction is aborted"
      // rather than their own error) - each assertion gets a fresh
      // transaction so it's checking the *real* rejection reason.
      for (const sql of [`INSERT INTO secrets (id) VALUES (99)`, `UPDATE secrets SET id = 0`, `DELETE FROM secrets`]) {
        await client.query("BEGIN");
        await asUser(client, userAId);
        await client.query(`SET LOCAL search_path TO "${schemaA}"`);
        await expect(client.query(sql)).rejects.toThrow(/read-only/i);
        await client.query("ROLLBACK");
      }
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }
  });

  it("rejects COPY ... TO PROGRAM", async () => {
    const client = await connectAsSandboxRunner();
    try {
      // Postgres restricts COPY TO/FROM PROGRAM to superusers (or the
      // pg_execute_server_program role, never granted here) independent of
      // read-only mode - a stricter rejection than the other DDL/DML cases.
      await expect(
        client.query(`COPY (SELECT 1) TO PROGRAM 'cat > /tmp/pwned'`),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await client.end();
    }
  });

  it("never has dblink or postgres_fdw installed", async () => {
    const result = await pool.query(
      `SELECT extname FROM pg_extension WHERE extname IN ('dblink', 'postgres_fdw')`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it("cannot read another student's schema even when fully-qualified (defense in depth beyond the AST layer)", async () => {
    // Regression test for the gap this documented before the per-user-role
    // fix: sandbox_runner used to hold a role-wide GRANT SELECT on every
    // sandbox schema, so a schema-qualified reference to another student's
    // schema read straight through regardless of search_path - the AST
    // validator's schema-qualification check was the *only* thing stopping
    // it. Now sandbox_runner's own privilege set is empty; a session must
    // `SET ROLE` to one specific student's role (SandboxService.
    // ensureUserRole grants it `WITH INHERIT FALSE`, so it's never
    // automatic) to read anything, and that role only has grants on that
    // one student's own schema(s). Connect and activate userB's role (the
    // way a real execution for userB would), then try to read userA's
    // schema fully-qualified - Postgres itself must reject it.
    const client = await connectAsSandboxRunner();
    try {
      await client.query("BEGIN");
      await asUser(client, userBId);
      await client.query(`SET LOCAL search_path TO "${schemaB}"`);

      await expect(client.query(`SELECT * FROM "${schemaA}"."secrets"`)).rejects.toThrow(
        /permission denied/i,
      );

      // The failed statement above aborted this transaction, and `SET
      // LOCAL ROLE` reverts on ROLLBACK - start a fresh transaction and
      // re-activate userB's role for the sanity check below.
      await client.query("ROLLBACK");
      await client.query("BEGIN");
      await asUser(client, userBId);
      await client.query(`SET LOCAL search_path TO "${schemaB}"`);

      // Sanity check: the same role CAN read its own schema - proves the
      // rejection above is specifically about cross-user access, not a
      // broken grant that denies everything.
      const own = await client.query(`SELECT * FROM "${schemaB}"."secrets"`);
      expect(own.rows).toHaveLength(1);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }
  });

  it("sandbox_runner has no standing privileges on any sandbox schema until SET ROLE activates one student's role", async () => {
    const client = await connectAsSandboxRunner();
    try {
      // No SET ROLE performed - sandbox_runner's own privilege set (CONNECT
      // only, see migrations/1700000000002) must not include SELECT on any
      // sandbox schema, even the schema's own fully-qualified name. Each
      // assertion gets its own transaction since a rejected statement
      // aborts the rest of the one it ran in.
      for (const schema of [schemaA, schemaB]) {
        await client.query("BEGIN");
        await expect(client.query(`SELECT * FROM "${schema}"."secrets"`)).rejects.toThrow(
          /permission denied/i,
        );
        await client.query("ROLLBACK");
      }
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }
  });

  it("enforces resource limits at the DB level independent of the AST layer", async () => {
    const client = await connectAsSandboxRunner();
    try {
      await client.query("BEGIN");
      await asUser(client, userAId);
      await client.query(`SET LOCAL search_path TO "${schemaA}"`);
      await client.query("SET LOCAL statement_timeout = 500");
      // A cartesian join is a "benign-looking" way an expensive query could
      // slip past a naive validator - some independent DB-level guard (the
      // 500ms statement_timeout, or the role's temp_file_limit if the query
      // spills to disk before it would time out) must catch it regardless
      // of which one wins the race.
      await expect(
        client.query(
          `SELECT count(*) FROM secrets a, secrets b, secrets c, secrets d, generate_series(1, 5000000) g`,
        ),
      ).rejects.toThrow(/statement timeout|temp_file_limit/i);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      await client.end();
    }
  });

  it("has idle-in-transaction termination and read-only mode baked in at the role level", async () => {
    const config =
      (
        await pool.query<{ rolconfig: string[] }>(
          `SELECT rolconfig FROM pg_roles WHERE rolname = 'sandbox_runner'`,
        )
      ).rows[0]?.rolconfig ?? [];
    expect(config.some((c) => c.startsWith("idle_in_transaction_session_timeout="))).toBe(true);
    expect(config.some((c) => c === "default_transaction_read_only=on")).toBe(true);
  });
});
