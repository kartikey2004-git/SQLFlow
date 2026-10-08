import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { createTestUser, createTestAssignment, cleanupTestData } from "../helpers/fixtures";
import { ExecutionService, ExecutionServiceError } from "../../src/services/sandbox/execution.service";
import { SandboxService } from "../../src/services/sandbox/sandbox.service";
import { GradingService } from "../../src/services/grading/grading.service";
import { getSandboxAdminPool } from "../../src/services/sandbox/sandboxDb";
import { pool } from "@sql-learn/database";

const app = createApp();

describe("Sandbox lifecycle (database per student)", () => {
  let userId: number;
  let assignmentId: number;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const { user, email, password } = await createTestUser();
    userId = user.id;
    const fixture = await createTestAssignment({ solutionSql: "SELECT * FROM widgets WHERE price > 20" });
    assignmentId = fixture.assignmentId;
    agent = request.agent(app);
    await agent.post("/auth/sign-in/email").send({ email, password });
  });

  afterAll(cleanupTestData);

  it("init and reset are asynchronous job submissions", async () => {
    const init = await agent.post("/sandbox/init").send({ assignmentId });
    expect(init.status).toBe(202);
    expect(init.body.data.jobId).toBeDefined();
  });

  it("provisions a dedicated database + login role on init (idempotent)", async () => {
    const first = await SandboxService.initSandbox(userId, assignmentId);
    expect(first.db).toBe(`student_u${userId}_a${assignmentId}`);
    const second = await SandboxService.initSandbox(userId, assignmentId);
    expect(second.created).toBe(false);

    const role = await getSandboxAdminPool().query(
      `SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin, rolconnlimit
         FROM pg_roles WHERE rolname = $1`,
      [`student_u${userId}`],
    );
    expect(role.rows[0]).toMatchObject({
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolbypassrls: false,
      rolcanlogin: true,
    });
    const members = await getSandboxAdminPool().query(
      `SELECT 1 FROM pg_auth_members m JOIN pg_roles g ON g.oid = m.roleid
        WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = $1) AND g.rolname LIKE 'pg\\_%'`,
      [`student_u${userId}`],
    );
    expect(members.rowCount).toBe(0);
  });

  it("runs SELECT and returns statements[]", async () => {
    const r = await ExecutionService.executeQuery(userId, assignmentId, "SELECT * FROM widgets WHERE price > 20 ORDER BY id");
    expect(r.aborted).toBe(false);
    expect(r.statements).toHaveLength(1);
    expect(r.statements[0]).toMatchObject({ command: "SELECT", rowCount: 2, truncated: false, columns: ["id", "price"] });
  });

  it("runs multi-statement DDL + DML and persists the changes", async () => {
    const r = await ExecutionService.executeQuery(
      userId,
      assignmentId,
      `CREATE TABLE notes (id serial PRIMARY KEY, body text);
       INSERT INTO notes (body) VALUES ('a'), ('b'), ('c');
       UPDATE notes SET body = upper(body) WHERE id > 1;
       DELETE FROM notes WHERE id = 1;
       SELECT body FROM notes ORDER BY id;`,
    );
    expect(r.aborted).toBe(false);
    expect(r.statements.map((s) => s.command)).toEqual(["CREATE", "INSERT", "UPDATE", "DELETE", "SELECT"]);
    expect(r.statements[1]!.rowCount).toBe(3);
    expect(r.statements[4]!.rows).toEqual([{ body: "B" }, { body: "C" }]);

    const again = await ExecutionService.executeQuery(userId, assignmentId, "SELECT count(*)::int AS n FROM notes");
    expect(again.statements[0]!.rows[0]).toEqual({ n: 2 });
  });

  it("supports transactions: ROLLBACK discards, COMMIT keeps, savepoints work", async () => {
    await ExecutionService.executeQuery(userId, assignmentId, "BEGIN; INSERT INTO notes (body) VALUES ('gone'); ROLLBACK;");
    await ExecutionService.executeQuery(userId, assignmentId, "BEGIN; INSERT INTO notes (body) VALUES ('kept'); COMMIT;");
    const sp = await ExecutionService.executeQuery(
      userId,
      assignmentId,
      `BEGIN; INSERT INTO notes (body) VALUES ('s1'); SAVEPOINT a; INSERT INTO notes (body) VALUES ('s2');
       ROLLBACK TO SAVEPOINT a; RELEASE SAVEPOINT a; COMMIT;`,
    );
    expect(sp.aborted).toBe(false);
    const rows = await ExecutionService.executeQuery(userId, assignmentId, "SELECT body FROM notes WHERE body IN ('gone','kept','s1','s2') ORDER BY body");
    expect(rows.statements[0]!.rows).toEqual([{ body: "kept" }, { body: "s1" }]);
  });

  it("an uncommitted transaction left open is rolled back when the run ends", async () => {
    await ExecutionService.executeQuery(userId, assignmentId, "BEGIN; INSERT INTO notes (body) VALUES ('dangling');");
    const r = await ExecutionService.executeQuery(userId, assignmentId, "SELECT count(*)::int AS n FROM notes WHERE body = 'dangling'");
    expect(r.statements[0]!.rows[0]).toEqual({ n: 0 });
  });

  it("stops at the first failing statement and reports it", async () => {
    const r = await ExecutionService.executeQuery(userId, assignmentId, "SELECT 1; SELECT * FROM nope; SELECT 3;");
    expect(r.aborted).toBe(true);
    expect(r.statements).toHaveLength(2);
    expect(r.statements[1]!.error).toMatchObject({ code: "42P01" });
  });

  it("caps large results without altering semantics", async () => {
    const r = await ExecutionService.executeQuery(userId, assignmentId, "SELECT g FROM generate_series(1, 100000) g");
    expect(r.statements[0]!.rows.length).toBe(1000);
    expect(r.statements[0]!.truncated).toBe(true);
  });

  it("supports CTEs, UNION, views, sequences, indexes, SELECT INTO, schema-qualified names, TRUNCATE, DROP", async () => {
    const r = await ExecutionService.executeQuery(
      userId,
      assignmentId,
      `CREATE VIEW pricey AS SELECT * FROM public.widgets WHERE price > 20;
       CREATE SEQUENCE s1; SELECT nextval('s1');
       CREATE INDEX widgets_price_idx ON public.widgets (price); DROP INDEX widgets_price_idx;
       WITH x AS (SELECT 1 AS a) SELECT a FROM x UNION SELECT 2 ORDER BY a;
       SELECT * INTO copy_of_widgets FROM public.widgets;
       TRUNCATE copy_of_widgets; DROP TABLE copy_of_widgets; DROP VIEW pricey; DROP SEQUENCE s1;`,
    );
    expect(r.aborted).toBe(false);
    expect(r.statements.at(-1)!.command).toBe("DROP");
  });

  it("enforces the script watchdog even if the student disables statement_timeout", async () => {
    const { withStudentConnection } = await import("../../src/services/sandbox/execution.service");
    const { runScript } = await import("../../src/services/sandbox/scriptRunner");
    const t0 = Date.now();
    const r = await withStudentConnection(
      `student_u${userId}`,
      `student_u${userId}_a${assignmentId}`,
      (c, d) => runScript(c, "SET statement_timeout = 0; SELECT pg_sleep(30);", d),
      1500,
    );
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(r.aborted).toBe(true);
    expect(r.statements.at(-1)!.error?.code).toBe("57014");
  });

  it("reset recreates the database from the template", async () => {
    await SandboxService.resetSandbox(userId, assignmentId);
    const r = await ExecutionService.executeQuery(userId, assignmentId, "SELECT count(*)::int AS n FROM widgets");
    expect(r.statements[0]!.rows[0]).toEqual({ n: 3 });
    const gone = await ExecutionService.executeQuery(userId, assignmentId, "SELECT * FROM notes");
    expect(gone.statements[0]!.error?.code).toBe("42P01");
  });

  it("grades a correct submission as passed and destroys the grading DB", async () => {
    const result = await GradingService.gradeSubmission(userId, assignmentId, "SELECT * FROM widgets WHERE price > 20");
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    const left = await getSandboxAdminPool().query(`SELECT 1 FROM pg_database WHERE datname ~ '^grade_s'`);
    expect(left.rowCount).toBe(0);
    const rolesLeft = await getSandboxAdminPool().query(`SELECT 1 FROM pg_roles WHERE rolname ~ '^grade_s'`);
    expect(rolesLeft.rowCount).toBe(0);
  });

  it("does not grade against (or modify) the student's persistent database", async () => {
    await ExecutionService.executeQuery(userId, assignmentId, "DELETE FROM widgets");
    const result = await GradingService.gradeSubmission(userId, assignmentId, "SELECT * FROM widgets WHERE price > 20");
    expect(result.passed).toBe(true);
  });

  it("grades an incorrect submission as failed with a reason", async () => {
    const result = await GradingService.gradeSubmission(userId, assignmentId, "SELECT * FROM widgets");
    expect(result.passed).toBe(false);
    expect(result.results[0]!.reason).toBeTruthy();
  });

  it("a submission whose SQL errors ends in a terminal state - never stuck 'evaluating'", async () => {
    const result = await GradingService.gradeSubmission(userId, assignmentId, "SELECT * FROM does_not_exist");
    expect(result.passed).toBe(false);
    const row = await pool.query(`SELECT status FROM submissions WHERE id = $1`, [result.submissionId]);
    expect(row.rows[0].status).toBe("completed");
  });

  it("grades DML/DDL via post-state validation_sql", async () => {
    const { assignmentId: dmlAssignment } = await createTestAssignment();
    await pool.query(`DELETE FROM test_cases WHERE assignment_id = $1`, [dmlAssignment]);
    await pool.query(
      `INSERT INTO test_cases (assignment_id, name, expected_output_type, expected_output, validation_sql, is_hidden, order_index)
       VALUES ($1, 'row inserted', 'count', '1', 'SELECT count(*) FROM public.widgets WHERE id = 99', false, 0)`,
      [dmlAssignment],
    );
    await SandboxService.initSandbox(userId, dmlAssignment);
    const ok = await GradingService.gradeSubmission(userId, dmlAssignment, "INSERT INTO widgets VALUES (99, 1);");
    expect(ok.passed).toBe(true);
    const bad = await GradingService.gradeSubmission(userId, dmlAssignment, "SELECT 1;");
    expect(bad.passed).toBe(false);
  });

  it("throws SANDBOX_NOT_FOUND for a user who never initialized a sandbox", async () => {
    const { user: other } = await createTestUser();
    await expect(ExecutionService.executeQuery(other.id, assignmentId, "SELECT 1")).rejects.toBeInstanceOf(
      ExecutionServiceError,
    );
  });

  it("persists query_executions and submissions rows for auditability", async () => {
    const attempt = await pool.query(`SELECT id FROM attempts WHERE user_id = $1 AND assignment_id = $2`, [userId, assignmentId]);
    const attemptId = attempt.rows[0].id;
    expect((await pool.query(`SELECT 1 FROM query_executions WHERE attempt_id = $1`, [attemptId])).rowCount).toBeGreaterThan(0);
    expect((await pool.query(`SELECT 1 FROM submissions WHERE attempt_id = $1`, [attemptId])).rowCount).toBeGreaterThan(0);
  });
});
