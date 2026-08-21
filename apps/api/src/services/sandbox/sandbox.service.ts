import { pool } from "@sql-learn/database";
import { AssignmentRepository } from "../../repositories/assignment.repository";
import { AttemptRepository } from "../../repositories/attempt.repository";
import { ApiError } from "../../utils/ApiError";
import type { SampleTableRow } from "../../repositories/assignment.repository";

export class SandboxService {
  static generateSchemaName(userId: number, assignmentId: number): string {
    const schemaName = `sb_u${userId}_a${assignmentId}`;
    return schemaName.length > 63 ? schemaName.substring(0, 63) : schemaName;
  }

  /**
   * Postgres identifier for a student's own per-user role (see
   * migrations/1700000000002_sandbox_runner_role.cjs's header comment and
   * ExecutionService.executeQuery for how this is activated). One role per
   * *user*, covering every schema that user has - not one per schema, since
   * a student accumulates a schema per assignment.
   */
  static sandboxUserRole(userId: number): string {
    return `sandbox_user_${userId}`;
  }

  /**
   * Ensures `userId`'s NOLOGIN Postgres role exists and that `sandbox_runner`
   * is a member of it **without inheriting it** (`WITH INHERIT FALSE`,
   * PostgreSQL 16+). This is the actual defense-in-depth backstop behind the
   * AST validator's schema-qualification check (see validation.service.ts):
   * `sandbox_runner`'s own privilege set never includes any student's
   * schema grants - a session must explicitly `SET ROLE` to *this exact*
   * per-user role (ExecutionService does so, scoped to the query's own
   * `userId`) to use them. Even if the AST validator had a bug that let a
   * schema-qualified reference to another student's schema through, the
   * role activated for that session would still lack any grant on it, and
   * Postgres itself would reject the query with "permission denied for
   * schema ...". See tests/security/sandboxIsolation.test.ts.
   */
  private static async ensureUserRole(client: import("pg").PoolClient, userId: number): Promise<string> {
    const roleName = this.sandboxUserRole(userId);
    // roleName is built from a numeric userId (never user-controlled text),
    // never from user input - safe to interpolate as an identifier, same
    // reasoning as schemaName below.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${roleName}') THEN
          CREATE ROLE "${roleName}" NOLOGIN;
        END IF;
      END
      $$;
    `);
    await client.query(`GRANT "${roleName}" TO sandbox_runner WITH INHERIT FALSE`);
    return roleName;
  }

  /**
   * Creates the schema and grants the student's own per-user role (not
   * `sandbox_runner` directly - see ensureUserRole) SELECT on it. ALTER
   * DEFAULT PRIVILEGES is applied *before* the tables are created (by the
   * admin role, in this same connection) so the role automatically gets
   * SELECT on every table this provisioning step creates, without a second
   * grant pass.
   */
  private static async createSchema(
    client: import("pg").PoolClient,
    schemaName: string,
    userId: number,
  ): Promise<void> {
    const roleName = await this.ensureUserRole(client, userId);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO "${roleName}"`);
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT SELECT ON TABLES TO "${roleName}"`,
    );
  }

  private static generateCreateTableStatement(schemaName: string, table: SampleTableRow): string {
    const columnDefinitions = table.columns
      .map((column) => `"${column.columnName}" ${column.dataType}`)
      .join(", ");
    return `CREATE TABLE "${schemaName}"."${table.tableName}" (${columnDefinitions})`;
  }

  private static async createTables(
    client: import("pg").PoolClient,
    schemaName: string,
    sampleTables: SampleTableRow[],
  ): Promise<void> {
    for (const table of sampleTables) {
      await client.query(this.generateCreateTableStatement(schemaName, table));
    }
  }

  private static generateInsertStatement(
    schemaName: string,
    tableName: string,
    row: Record<string, unknown>,
    columns: { columnName: string; dataType: string }[],
  ): string {
    const columnNames = columns.map((col) => `"${col.columnName}"`).join(", ");
    const values = columns
      .map((col) => {
        const value = row[col.columnName];
        if (value === null || value === undefined) return "NULL";
        if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      })
      .join(", ");
    return `INSERT INTO "${schemaName}"."${tableName}" (${columnNames}) VALUES (${values})`;
  }

  private static async insertRows(
    client: import("pg").PoolClient,
    schemaName: string,
    sampleTables: SampleTableRow[],
  ): Promise<void> {
    for (const table of sampleTables) {
      for (const row of table.rows) {
        await client.query(this.generateInsertStatement(schemaName, table.tableName, row, table.columns));
      }
    }
  }

  static async initSandbox(
    userId: number,
    assignmentId: number,
  ): Promise<{ schemaName: string; isNew: boolean }> {
    const existingAttempt = await AttemptRepository.findByUserAndAssignment(userId, assignmentId);
    if (existingAttempt?.schema_name) {
      return { schemaName: existingAttempt.schema_name, isNew: false };
    }

    const assignment = await AssignmentRepository.findPublicById(assignmentId);
    if (!assignment) {
      throw new ApiError(404, "Assignment not found");
    }

    const schemaName = this.generateSchemaName(userId, assignmentId);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.createSchema(client, schemaName, userId);
      await this.createTables(client, schemaName, assignment.sample_tables);
      await this.insertRows(client, schemaName, assignment.sample_tables);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const attempt = await AttemptRepository.getOrCreate(userId, assignmentId);
    await AttemptRepository.setSchemaProvisioned(attempt.id, schemaName);

    return { schemaName, isNew: true };
  }
}
