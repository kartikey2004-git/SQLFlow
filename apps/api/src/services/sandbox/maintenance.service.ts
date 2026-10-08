import { AttemptRepository } from "../../repositories/attempt.repository";
import { SandboxService } from "./sandbox.service";
import { getSandboxAdminPool } from "./sandboxDb";
import { logger } from "../../utils/logger";

const STUDENT_DB = /^student_u\d+_a\d+$/;
const GRADING_DB = /^grade_s\d+$/;
const ORPHAN_STUDENT_MIN_AGE_MS = 60 * 60 * 1000;
const ORPHAN_GRADING_MIN_AGE_MS = 15 * 60 * 1000;

function createdAt(comment: string | null): number | null {
  const m = /^created=(.+)$/.exec(comment ?? "");
  const t = m ? Date.parse(m[1]!) : NaN;
  return Number.isNaN(t) ? null : t;
}

export interface MaintenanceResult {
  staleStudentDbsDropped: number;
  orphanStudentDbsDropped: number;
  orphanGradingDbsDropped: number;
  orphanRolesDropped: number;
}

export class MaintenanceService {
  static async run(daysToKeep: number): Promise<MaintenanceResult> {
    const admin = getSandboxAdminPool();
    const result: MaintenanceResult = {
      staleStudentDbsDropped: 0,
      orphanStudentDbsDropped: 0,
      orphanGradingDbsDropped: 0,
      orphanRolesDropped: 0,
    };

    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    for (const attempt of await AttemptRepository.findStaleWithSandbox(cutoff)) {
      try {
        await SandboxService.dropDatabase(admin, attempt.sandbox_db!);
        await AttemptRepository.clearSandbox(attempt.id);
        result.staleStudentDbsDropped++;
      } catch (err) {
        logger.error({ err, db: attempt.sandbox_db }, "Failed to drop stale student database");
      }
    }

    const referenced = new Set(await AttemptRepository.findAllSandboxDbs());
    const dbs = await admin.query<{ datname: string; comment: string | null }>(
      `SELECT datname, shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname ~ '^(student_u|grade_s)'`,
    );
    const now = Date.now();
    for (const { datname, comment } of dbs.rows) {
      const created = createdAt(comment);
      const age = created === null ? Infinity : now - created;
      try {
        if (STUDENT_DB.test(datname) && !referenced.has(datname) && age > ORPHAN_STUDENT_MIN_AGE_MS) {
          await SandboxService.dropDatabase(admin, datname);
          result.orphanStudentDbsDropped++;
        } else if (GRADING_DB.test(datname) && age > ORPHAN_GRADING_MIN_AGE_MS) {
          await SandboxService.dropDatabase(admin, datname);
          result.orphanGradingDbsDropped++;
        }
      } catch (err) {
        logger.error({ err, db: datname }, "Failed to drop orphan database");
      }
    }

    const roles = await admin.query<{ rolname: string }>(
      `SELECT r.rolname FROM pg_roles r
        WHERE (r.rolname ~ '^student_u\\d+$' OR r.rolname ~ '^grade_s\\d+$')
          AND NOT EXISTS (SELECT 1 FROM pg_database d WHERE d.datdba = r.oid)`,
    );
    for (const { rolname } of roles.rows) {
      try {
        await SandboxService.dropRole(admin, rolname);
        result.orphanRolesDropped++;
      } catch (err) {
        logger.error({ err, role: rolname }, "Failed to drop orphan role");
      }
    }

    logger.info(result, "Sandbox maintenance finished");
    return result;
  }
}
