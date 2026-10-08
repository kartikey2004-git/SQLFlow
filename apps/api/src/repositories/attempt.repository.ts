import { pool } from "@sql-learn/database";

export interface AttemptRow {
  id: number;
  user_id: number;
  assignment_id: number;
  status: "in_progress" | "completed";
  last_query: string;
  attempt_count: number;
  completed_at: Date | null;
  schema_name: string | null;
  schema_provisioned_at: Date | null;
  sandbox_db: string | null;
  sandbox_provisioned_at: Date | null;
  last_attempt_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AttemptWithAssignmentRow extends AttemptRow {
  assignment_title: string;
  assignment_difficulty: "easy" | "medium" | "hard";
}

export interface AttemptUpdate {
  lastQuery?: string;
  incrementAttempt?: boolean;
  markCompleted?: boolean;
}

export const AttemptRepository = {
  async getOrCreate(userId: number, assignmentId: number): Promise<AttemptRow> {
    const result = await pool.query<AttemptRow>(
      `INSERT INTO attempts (user_id, assignment_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, assignment_id) DO UPDATE SET id = attempts.id
       RETURNING *`,
      [userId, assignmentId],
    );
    return result.rows[0]!;
  },

  async findById(id: number): Promise<AttemptRow | null> {
    const result = await pool.query<AttemptRow>(`SELECT * FROM attempts WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  },

  async findByUserAndAssignment(userId: number, assignmentId: number): Promise<AttemptRow | null> {
    const result = await pool.query<AttemptRow>(
      `SELECT * FROM attempts WHERE user_id = $1 AND assignment_id = $2`,
      [userId, assignmentId],
    );
    return result.rows[0] ?? null;
  },

  async setSandboxProvisioned(id: number, sandboxDb: string): Promise<AttemptRow> {
    const result = await pool.query<AttemptRow>(
      `UPDATE attempts SET sandbox_db = $2, sandbox_provisioned_at = now() WHERE id = $1 RETURNING *`,
      [id, sandboxDb],
    );
    return result.rows[0]!;
  },

  async findStaleWithSandbox(cutoff: Date): Promise<AttemptRow[]> {
    const result = await pool.query<AttemptRow>(
      `SELECT * FROM attempts WHERE sandbox_db IS NOT NULL AND last_attempt_at < $1`,
      [cutoff],
    );
    return result.rows;
  },

  async findAllSandboxDbs(): Promise<string[]> {
    const result = await pool.query<{ sandbox_db: string }>(
      `SELECT sandbox_db FROM attempts WHERE sandbox_db IS NOT NULL`,
    );
    return result.rows.map((r) => r.sandbox_db);
  },

  async clearSandbox(id: number): Promise<void> {
    await pool.query(
      `UPDATE attempts SET sandbox_db = NULL, sandbox_provisioned_at = NULL WHERE id = $1`,
      [id],
    );
  },

  async update(userId: number, assignmentId: number, updates: AttemptUpdate): Promise<AttemptRow> {
    const setClauses: string[] = ["last_attempt_at = now()"];
    const values: unknown[] = [userId, assignmentId];

    if (updates.lastQuery !== undefined) {
      values.push(updates.lastQuery);
      setClauses.push(`last_query = $${values.length}`);
    }
    if (updates.incrementAttempt) {
      setClauses.push(`attempt_count = attempts.attempt_count + 1`);
    }
    if (updates.markCompleted) {
      setClauses.push(`status = 'completed'`, `completed_at = now()`);
    }

    const result = await pool.query<AttemptRow>(
      `INSERT INTO attempts (user_id, assignment_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, assignment_id) DO UPDATE SET ${setClauses.join(", ")}
       RETURNING *`,
      values,
    );
    return result.rows[0]!;
  },

  async findAllForUser(userId: number): Promise<AttemptWithAssignmentRow[]> {
    const result = await pool.query<AttemptWithAssignmentRow>(
      `SELECT a.*, asg.title AS assignment_title, asg.difficulty AS assignment_difficulty
       FROM attempts a
       JOIN assignments asg ON asg.id = a.assignment_id
       WHERE a.user_id = $1
       ORDER BY a.last_attempt_at DESC`,
      [userId],
    );
    return result.rows;
  },

  async deleteForUser(userId: number, assignmentId: number): Promise<void> {
    await pool.query(`DELETE FROM attempts WHERE user_id = $1 AND assignment_id = $2`, [
      userId,
      assignmentId,
    ]);
  },
};