import { createHash } from "node:crypto";
import pg from "pg";
import { AssignmentRepository } from "../../repositories/assignment.repository";
import { AttemptRepository } from "../../repositories/attempt.repository";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import type { SampleTableRow } from "../../repositories/assignment.repository";
import {
  adminUrlForDb,
  getSandboxAdminPool,
  gradingDbName,
  gradingRole,
  quoteIdent,
  quoteLiteral,
  rolePasswordFor,
  studentDbName,
  studentRole,
  templateDbName,
} from "./sandboxDb";

const { Client } = pg;

const ROLE_CONNECTION_LIMIT = 3;
const ROLE_SETTINGS: Record<string, string> = {
  statement_timeout: "10s",
  lock_timeout: "3s",
  idle_in_transaction_session_timeout: "15s",
  work_mem: "8MB",
  temp_file_limit: "64MB",
  max_parallel_workers_per_gather: "0",
};

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<pg.QueryResult> };

export class SandboxService {

  private static async ensureRole(admin: Queryable, role: string): Promise<void> {
    const exists = await admin.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [role]);
    const tail =
      `NOINHERIT CONNECTION LIMIT ${ROLE_CONNECTION_LIMIT} PASSWORD ${quoteLiteral(rolePasswordFor(role))}`;
    if (exists.rowCount === 0) {
      try {
        await admin.query(`CREATE ROLE ${quoteIdent(role)} LOGIN ${tail}`);
      } catch (e) {
        if ((e as { code?: string }).code !== "42710") throw e;
      }
    }
    await admin.query(`ALTER ROLE ${quoteIdent(role)} LOGIN NOCREATEDB NOCREATEROLE ${tail}`);
    for (const [k, v] of Object.entries(ROLE_SETTINGS)) {
      try {
        await admin.query(`ALTER ROLE ${quoteIdent(role)} SET ${k} = ${quoteLiteral(v)}`);
      } catch (err) {
        if ((err as { code?: string }).code !== "42501") throw err;
        logger.warn({ param: k }, "Could not set role-level parameter; rely on instance-level setting");
      }
    }
    await admin.query(`GRANT ${quoteIdent(role)} TO CURRENT_USER WITH INHERIT TRUE, SET TRUE`).catch(() => {});
  }

  static async dropRole(admin: Queryable, role: string): Promise<void> {
    await admin.query(`DROP ROLE IF EXISTS ${quoteIdent(role)}`);
  }

  private static tableDdl(table: SampleTableRow): string {
    const cols = table.columns.map((c) => `${quoteIdent(c.columnName)} ${c.dataType}`).join(", ");
    return `CREATE TABLE public.${quoteIdent(table.tableName)} (${cols})`;
  }

  private static insertSql(table: SampleTableRow, row: Record<string, unknown>): string {
    const names = table.columns.map((c) => quoteIdent(c.columnName)).join(", ");
    const values = table.columns
      .map((c) => {
        const v = row[c.columnName];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        if (typeof v === "string") return quoteLiteral(v);
        return quoteLiteral(JSON.stringify(v));
      })
      .join(", ");
    return `INSERT INTO public.${quoteIdent(table.tableName)} (${names}) VALUES (${values})`;
  }

  private static async withTemplate<T>(
    assignmentId: number,
    sampleTables: SampleTableRow[],
    fn: (tpl: string) => Promise<T>,
  ): Promise<T> {
    const tpl = templateDbName(assignmentId);
    const hash = createHash("sha256").update(JSON.stringify(sampleTables)).digest("hex");
    const lockKey = `sqlflow-template-${assignmentId}`;
    const lockClient = await getSandboxAdminPool().connect();
    try {
      const current = async () => {
        const r = await lockClient.query<{ c: string | null }>(
          `SELECT shobj_description(oid, 'pg_database') AS c FROM pg_database WHERE datname = $1`,
          [tpl],
        );
        return r.rowCount === 0 ? "missing" : (r.rows[0]!.c ?? "");
      };

      if ((await current()) !== hash) {
        await lockClient.query(`SELECT pg_advisory_lock(hashtext($1))`, [lockKey]);
        try {
          if ((await current()) !== hash) await this.buildTemplate(lockClient, tpl, sampleTables, hash);
        } finally {
          await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [lockKey]);
        }
      }
      await lockClient.query(`SELECT pg_advisory_lock_shared(hashtext($1))`, [lockKey]);
      try {
        return await fn(tpl);
      } finally {
        await lockClient.query(`SELECT pg_advisory_unlock_shared(hashtext($1))`, [lockKey]);
      }
    } finally {
      lockClient.release();
    }
  }

  private static async buildTemplate(
    admin: Queryable,
    tpl: string,
    sampleTables: SampleTableRow[],
    hash: string,
  ): Promise<void> {
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(tpl)} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${quoteIdent(tpl)}`);
    const c = new Client({ connectionString: adminUrlForDb(tpl) });
    await c.connect();
    try {
      await c.query("BEGIN");
      for (const table of sampleTables) {
        await c.query(this.tableDdl(table));
        for (const row of table.rows) await c.query(this.insertSql(table, row));
      }
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      await c.end();
    }
    await admin.query(`REVOKE CONNECT ON DATABASE ${quoteIdent(tpl)} FROM PUBLIC`);
    await admin.query(`COMMENT ON DATABASE ${quoteIdent(tpl)} IS ${quoteLiteral(hash)}`);
  }

  private static async cloneFromTemplate(admin: Queryable, tpl: string, db: string, role: string): Promise<void> {
    await admin.query(`CREATE DATABASE ${quoteIdent(db)} TEMPLATE ${quoteIdent(tpl)} OWNER ${quoteIdent(role)}`);
    await admin.query(`REVOKE ALL ON DATABASE ${quoteIdent(db)} FROM PUBLIC`);
    await admin.query(`GRANT CONNECT ON DATABASE ${quoteIdent(db)} TO ${quoteIdent(role)}`);
    await admin.query(`ALTER DATABASE ${quoteIdent(db)} CONNECTION LIMIT ${ROLE_CONNECTION_LIMIT + 2}`);
    await admin.query(`COMMENT ON DATABASE ${quoteIdent(db)} IS ${quoteLiteral(`created=${new Date().toISOString()}`)}`);

    const c = new Client({ connectionString: adminUrlForDb(db) });
    await c.connect();
    try {
      const rels = await c.query<{ ident: string }>(
        `SELECT format('%I.%I', n.nspname, c.relname) AS ident
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')
            AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a','i'))`,
      );
      for (const r of rels.rows) await c.query(`ALTER TABLE ${r.ident} OWNER TO ${quoteIdent(role)}`);
      await c.query(`ALTER SCHEMA public OWNER TO ${quoteIdent(role)}`);
      await c.query(`REVOKE ALL ON SCHEMA public FROM PUBLIC`);
    } finally {
      await c.end();
    }
  }

  static async dropDatabase(admin: Queryable, db: string): Promise<void> {
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(db)} WITH (FORCE)`);
  }

  private static async requireAssignment(assignmentId: number) {
    const assignment = await AssignmentRepository.findPublicById(assignmentId);
    if (!assignment) throw new ApiError(404, "Assignment not found");
    return assignment;
  }

  static async initSandbox(userId: number, assignmentId: number): Promise<{ db: string; created: boolean }> {
    const db = studentDbName(userId, assignmentId);
    const assignment = await this.requireAssignment(assignmentId);
    const created = await this.createStudentDb(userId, assignmentId, assignment.sample_tables, false);
    const attempt = await AttemptRepository.getOrCreate(userId, assignmentId);
    await AttemptRepository.setSandboxProvisioned(attempt.id, db);
    return { db, created };
  }

  static async resetSandbox(userId: number, assignmentId: number): Promise<{ db: string; created: boolean }> {
    const db = studentDbName(userId, assignmentId);
    const assignment = await this.requireAssignment(assignmentId);
    await this.createStudentDb(userId, assignmentId, assignment.sample_tables, true);
    const attempt = await AttemptRepository.getOrCreate(userId, assignmentId);
    await AttemptRepository.setSandboxProvisioned(attempt.id, db);
    return { db, created: true };
  }

  private static async createStudentDb(
    userId: number,
    assignmentId: number,
    sampleTables: SampleTableRow[],
    drop: boolean,
  ): Promise<boolean> {
    const admin = getSandboxAdminPool();
    const role = studentRole(userId);
    const db = studentDbName(userId, assignmentId);
    const lockKey = `sqlflow-student-${db}`;
    const lock = await admin.connect();
    try {
      await lock.query(`SELECT pg_advisory_lock(hashtext($1))`, [lockKey]);
      try {
        await this.ensureRole(lock, role);
        const present = await lock.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [db]);
        if (present.rowCount && !drop) return false;
        if (present.rowCount) await this.dropDatabase(lock, db);
        await this.withTemplate(assignmentId, sampleTables, (tpl) => this.cloneFromTemplate(lock, tpl, db, role));
        return true;
      } finally {
        await lock.query(`SELECT pg_advisory_unlock(hashtext($1))`, [lockKey]);
      }
    } finally {
      lock.release();
    }
  }

  static async createGradingDb(submissionId: number, assignmentId: number): Promise<{ db: string; role: string }> {
    const assignment = await this.requireAssignment(assignmentId);
    const admin = getSandboxAdminPool();
    const db = gradingDbName(submissionId);
    const role = gradingRole(submissionId);
    await this.dropDatabase(admin, db);
    await this.ensureRole(admin, role);
    await this.withTemplate(assignmentId, assignment.sample_tables, (tpl) =>
      this.cloneFromTemplate(admin, tpl, db, role),
    );
    return { db, role };
  }

  static async destroyGradingDb(submissionId: number): Promise<void> {
    const admin = getSandboxAdminPool();
    await this.dropDatabase(admin, gradingDbName(submissionId)).catch(() => {});
    await this.dropRole(admin, gradingRole(submissionId)).catch(() => {});
  }

  static async hardenInstance(): Promise<void> {
    const admin = getSandboxAdminPool();
    for (const db of ["postgres", "template1"]) {
      await admin.query(`REVOKE CONNECT ON DATABASE ${quoteIdent(db)} FROM PUBLIC`).catch((err) => {
        logger.warn({ err, db }, "Could not revoke PUBLIC CONNECT (is the admin the database owner?)");
      });
    }
  }

  static async databaseSize(db: string): Promise<number> {
    const r = await getSandboxAdminPool().query<{ s: string }>(`SELECT pg_database_size($1) AS s`, [db]);
    return Number(r.rows[0]?.s ?? 0);
  }

  static async cancelBackend(pid: number, terminate: boolean): Promise<void> {
    await getSandboxAdminPool().query(
      terminate ? `SELECT pg_terminate_backend($1)` : `SELECT pg_cancel_backend($1)`,
      [pid],
    );
  }
}
