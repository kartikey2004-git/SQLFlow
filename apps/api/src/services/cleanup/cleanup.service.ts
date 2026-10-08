import { pool } from "@sql-learn/database";
import { SubmissionRepository } from "../../repositories/submission.repository";
import { getBoss, MAINTENANCE_QUEUE } from "../../queue/boss";
import type { MaintenanceJobPayload } from "../../queue/types";

export class CleanupService {
  static async reconcileStaleSubmissions(staleMinutes = 5): Promise<{ reconciled: number }> {
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
    const stale = await SubmissionRepository.findStaleEvaluating(cutoff);
    for (const submission of stale) {
      await SubmissionRepository.updateResult(submission.id, {
        status: "failed",
        errorMessage: "Reconciled: submission was stuck evaluating past the stale threshold",
      });
    }
    return { reconciled: stale.length };
  }

  static async deleteOldQueryExecutions(daysToKeep: number): Promise<{ deleted: number }> {
    const r = await pool.query(`DELETE FROM query_executions WHERE created_at < now() - ($1::int * interval '1 day')`, [
      daysToKeep,
    ]);
    return { deleted: r.rowCount ?? 0 };
  }

  static async enqueueSandboxMaintenance(daysToKeep: number): Promise<string | null> {
    const boss = await getBoss();
    const payload: MaintenanceJobPayload = { daysToKeep };
    return boss.send(MAINTENANCE_QUEUE, payload, { singletonKey: "sandbox-maintenance" });
  }

  static async performFullCleanup(daysToKeep: number): Promise<{
    staleSubmissionsReconciled: number;
    queryExecutionsDeleted: number;
    sandboxMaintenanceJobId: string | null;
  }> {
    const { reconciled } = await this.reconcileStaleSubmissions();
    const { deleted } = await this.deleteOldQueryExecutions(daysToKeep);
    const sandboxMaintenanceJobId = await this.enqueueSandboxMaintenance(daysToKeep);
    return {
      staleSubmissionsReconciled: reconciled,
      queryExecutionsDeleted: deleted,
      sandboxMaintenanceJobId,
    };
  }

  static async getCleanupStats(): Promise<{
    provisionedSandboxes: number;
    evaluatingSubmissions: number;
    queryExecutions: number;
  }> {
    const r = await pool.query<{ sandboxes: string; evaluating: string; executions: string }>(
      `SELECT (SELECT count(*) FROM attempts WHERE sandbox_db IS NOT NULL) AS sandboxes,
              (SELECT count(*) FROM submissions WHERE status = 'evaluating') AS evaluating,
              (SELECT count(*) FROM query_executions) AS executions`,
    );
    const row = r.rows[0]!;
    return {
      provisionedSandboxes: Number(row.sandboxes),
      evaluatingSubmissions: Number(row.evaluating),
      queryExecutions: Number(row.executions),
    };
  }
}
