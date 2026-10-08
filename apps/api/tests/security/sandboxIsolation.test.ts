import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { createTestUser, createTestAssignment, cleanupTestData } from "../helpers/fixtures";
import { SandboxService } from "../../src/services/sandbox/sandbox.service";
import { ExecutionService, withStudentConnection } from "../../src/services/sandbox/execution.service";
import { roleUrlForDb, adminUrlForDb } from "../../src/services/sandbox/sandboxDb";

describe("Student isolation (database + role per student)", () => {
  let a: number;
  let b: number;
  let assignmentId: number;

  beforeAll(async () => {
    a = (await createTestUser()).user.id;
    b = (await createTestUser()).user.id;
    assignmentId = (await createTestAssignment()).assignmentId;
    await SandboxService.initSandbox(a, assignmentId);
    await SandboxService.initSandbox(b, assignmentId);
    await SandboxService.hardenInstance();
    await ExecutionService.executeQuery(b, assignmentId, "CREATE TABLE secret_b (v text); INSERT INTO secret_b VALUES ('b-only');");
  });

  afterAll(cleanupTestData);

  const dbOf = (u: number) => `student_u${u}_a${assignmentId}`;
  const roleOf = (u: number) => `student_u${u}`;

  const connectAs = async (role: string, db: string) => {
    const c = new pg.Client({ connectionString: roleUrlForDb(role, db) });
    await c.connect();
    return c;
  };

  it("user A cannot connect to user B's database (and vice versa)", async () => {
    await expect(connectAs(roleOf(a), dbOf(b))).rejects.toMatchObject({ code: "42501" });
    await expect(connectAs(roleOf(b), dbOf(a))).rejects.toMatchObject({ code: "42501" });
  });

  it("a student cannot connect to the maintenance DB or any template", async () => {
    await expect(connectAs(roleOf(a), "postgres")).rejects.toBeDefined();
    await expect(connectAs(roleOf(a), `sandbox_template_a${assignmentId}`)).rejects.toMatchObject({ code: "42501" });
  });

  it("SET ROLE to another student fails", async () => {
    const r = await ExecutionService.executeQuery(a, assignmentId, `SET ROLE "${roleOf(b)}"`);
    expect(r.statements[0]!.error).toBeDefined();
  });

  const forbidden: [string, string][] = [
    ["CREATE ROLE", "CREATE ROLE evil LOGIN"],
    ["ALTER ROLE other", `ALTER ROLE "${"student_u0"}" SUPERUSER`],
    ["CREATE DATABASE", "CREATE DATABASE evil"],
    ["DROP DATABASE", "DROP DATABASE postgres"],
    ["COPY PROGRAM", "COPY (SELECT 1) TO PROGRAM 'id'"],
    ["COPY FILE", "COPY (SELECT 1) TO '/tmp/x'"],
    ["pg_read_file", "SELECT pg_read_file('/etc/hostname')"],
    ["pg_ls_dir", "SELECT pg_ls_dir('/')"],
    ["pg_terminate_backend", "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid()"],
    ["ALTER SYSTEM", "ALTER SYSTEM SET work_mem = '1GB'"],
    ["CREATE EXTENSION (untrusted)", "CREATE EXTENSION file_fdw"],
    ["lo_import", "SELECT lo_import('/etc/hostname')"],
    ["GRANT predefined role", "GRANT pg_read_server_files TO CURRENT_USER"],
  ];
  for (const [name, sql] of forbidden) {
    it(`PostgreSQL rejects: ${name}`, async () => {
      const r = await ExecutionService.executeQuery(a, assignmentId, sql);
      const failed = r.statements.find((s) => s.error);
      expect(failed, `${sql} unexpectedly succeeded`).toBeDefined();
    });
  }

  it("cannot read the other student's data through any schema or the catalog", async () => {
    const r = await ExecutionService.executeQuery(a, assignmentId, "SELECT * FROM secret_b");
    expect(r.statements[0]!.error?.code).toBe("42P01");
    const cat = await ExecutionService.executeQuery(a, assignmentId, "SELECT datname FROM pg_database WHERE datname = current_database()");
    expect(cat.statements[0]!.rows).toEqual([{ datname: dbOf(a) }]);
  });

  it("student role has no attribute or predefined-role escalation", async () => {
    const r = await ExecutionService.executeQuery(
      a,
      assignmentId,
      `SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
              pg_has_role(current_user, 'pg_read_server_files', 'member') AS rsf,
              pg_has_role(current_user, 'pg_write_server_files', 'member') AS wsf,
              pg_has_role(current_user, 'pg_execute_server_program', 'member') AS esp,
              pg_has_role(current_user, 'pg_signal_backend', 'member') AS sb
         FROM pg_roles WHERE rolname = current_user`,
    );
    expect(r.statements[0]!.rows[0]).toEqual({
      rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false,
      rsf: false, wsf: false, esp: false, sb: false,
    });
  });

  it("per-role CONNECTION LIMIT is enforced (connection exhaustion)", async () => {
    const clients: pg.Client[] = [];
    await new Promise((r) => setTimeout(r, 1000));
    try {
      for (let i = 0; i < 3; i++) clients.push(await connectAs(roleOf(a), dbOf(a)));
      await expect(connectAs(roleOf(a), dbOf(a))).rejects.toMatchObject({ code: "53300" });
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
  });

  it("temp_file_limit cannot be raised by the student (disk exhaustion guard)", async () => {
    const r = await ExecutionService.executeQuery(a, assignmentId, "SET temp_file_limit = -1");
    expect(r.statements[0]!.error).toBeDefined();
  });

  it("a lock held by one student cannot block another student", async () => {
    const lockHolder = withStudentConnection(roleOf(a), dbOf(a), async (c) => {
      await c.query("BEGIN; LOCK TABLE widgets IN ACCESS EXCLUSIVE MODE");
      await new Promise((r) => setTimeout(r, 1500));
    });
    await new Promise((r) => setTimeout(r, 300));
    const t0 = Date.now();
    const r = await ExecutionService.executeQuery(b, assignmentId, "SELECT count(*)::int AS n FROM widgets");
    expect(r.aborted).toBe(false);
    expect(Date.now() - t0).toBeLessThan(1400);
    await lockHolder;
  });

  it("the admin URL helper points at a different database than students can reach", () => {
    expect(adminUrlForDb("postgres")).not.toEqual(roleUrlForDb(roleOf(a), "postgres"));
  });
});
