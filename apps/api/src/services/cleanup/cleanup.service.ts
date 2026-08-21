import { pool } from "@sql-learn/database";
import { AttemptRepository } from "../../repositories/attempt.repository";
import { SubmissionRepository } from "../../repositories/submission.repository";

export class CleanupService {
  /**
   * Reconciliation sweep (prompt.md §16): a submission stuck in
   * "evaluating" past `staleMinutes` means the worker that owned it died
   * (crash, kill, lost DB connection) between marking it evaluating and
   * persisting a result - it will never resolve on its own. Flips it to
   * "failed" so it doesn't stay permanently stuck and the student can
   * resubmit. `staleMinutes` should comfortably exceed the pg-boss job's
   * `expireInSeconds` (30s, see queue/boss.ts) plus its one retry - default
   * 5 minutes leaves generous margin without being so long that a student
   * is left staring at "evaluating" for an unreasonable time after a real
   * crash.
   */
  static async reconcileStaleSubmissions(staleMinutes = 5): Promise<{ reconciled: number }> {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    const stale = await SubmissionRepository.findStaleEvaluating(cutoff);

    for (const submission of stale) {
      await SubmissionRepository.updateResult(submission.id, {
        status: "failed",
        errorMessage: "Reconciled: submission was stuck evaluating past the stale threshold (worker likely crashed)",
      });
    }

    return { reconciled: stale.length };
  }
  /**
   * Drops sandbox schemas that haven't been touched in `daysToKeep` days.
   * Only the ephemeral Postgres schema is recycled - the attempt row (and a
   * student's progress/attempt history on it) is kept, just with
   * schema_name cleared so a future visit re-provisions a fresh sandbox.
   */
  static async cleanupOldSandboxes(daysToKeep: number): Promise<{ schemasDeleted: number }> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const staleAttempts = await AttemptRepository.findStaleWithSchema(cutoffDate);

    if (staleAttempts.length === 0) {
      return { schemasDeleted: 0 };
    }

    const client = await pool.connect();
    let schemasDeleted = 0;
    try {
      for (const attempt of staleAttempts) {
        try {
          await client.query(`DROP SCHEMA IF EXISTS "${attempt.schema_name}" CASCADE`);
          await AttemptRepository.clearSchema(attempt.id);
          schemasDeleted++;
        } catch (error) {
          console.error(`Failed to drop schema ${attempt.schema_name}:`, error);
        }
      }
    } finally {
      client.release();
    }

    return { schemasDeleted };
  }

  /** Drops any sb_* Postgres schema no longer referenced by an attempt row. */
  static async cleanupOrphanedSchemas(): Promise<number> {
    const referencedSchemas = new Set(await AttemptRepository.findAllSchemaNames());

    const client = await pool.connect();
    try {
      const allSchemasResult = await client.query<{ schema_name: string }>(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'sb\\_%' ESCAPE '\\'`,
      );
      const orphaned = allSchemasResult.rows
        .map((row) => row.schema_name)
        .filter((name) => !referencedSchemas.has(name));

      let deletedCount = 0;
      for (const schema of orphaned) {
        try {
          await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to drop orphaned schema ${schema}:`, error);
        }
      }
      return deletedCount;
    } finally {
      client.release();
    }
  }

  static async performFullCleanup(daysToKeep: number): Promise<{
    schemasDeleted: number;
    orphanedSchemasDeleted: number;
    staleSubmissionsReconciled: number;
  }> {
    const sandboxCleanup = await this.cleanupOldSandboxes(daysToKeep);
    const orphanedSchemasDeleted = await this.cleanupOrphanedSchemas();
    const { reconciled } = await this.reconcileStaleSubmissions();

    return {
      schemasDeleted: sandboxCleanup.schemasDeleted,
      orphanedSchemasDeleted,
      staleSubmissionsReconciled: reconciled,
    };
  }

  static async getCleanupStats(): Promise<{
    totalProvisionedSandboxes: number;
    totalSchemasInDatabase: number;
    orphanedSchemas: number;
  }> {
    const referencedSchemas = await AttemptRepository.findAllSchemaNames();

    const client = await pool.connect();
    try {
      const allSchemasResult = await client.query<{ schema_name: string }>(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'sb\\_%' ESCAPE '\\'`,
      );
      const allSchemaNames = allSchemasResult.rows.map((row) => row.schema_name);
      const referencedSet = new Set(referencedSchemas);
      const orphanedSchemas = allSchemaNames.filter((name) => !referencedSet.has(name)).length;

      return {
        totalProvisionedSandboxes: referencedSchemas.length,
        totalSchemasInDatabase: allSchemaNames.length,
        orphanedSchemas,
      };
    } finally {
      client.release();
    }
  }
}
