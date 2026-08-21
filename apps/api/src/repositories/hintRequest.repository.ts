import { pool } from "@sql-learn/database";

export interface HintRequestRow {
  id: number;
  user_id: number;
  assignment_id: number;
  attempt_id: number | null;
  user_query: string;
  hint_level: number;
  concept_tag: string | null;
  hint_text: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  leak_check_passed: boolean;
  created_at: Date;
}

export const HintRequestRepository = {
  async create(data: {
    userId: number;
    assignmentId: number;
    attemptId: number | null;
    userQuery: string;
    hintLevel: number;
    conceptTag: string | null;
    hintText: string;
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    leakCheckPassed: boolean;
  }): Promise<HintRequestRow> {
    const result = await pool.query<HintRequestRow>(
      `INSERT INTO hint_requests
         (user_id, assignment_id, attempt_id, user_query, hint_level, concept_tag,
          hint_text, model, input_tokens, output_tokens, leak_check_passed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.userId,
        data.assignmentId,
        data.attemptId,
        data.userQuery,
        data.hintLevel,
        data.conceptTag,
        data.hintText,
        data.model ?? null,
        data.inputTokens ?? null,
        data.outputTokens ?? null,
        data.leakCheckPassed,
      ],
    );
    return result.rows[0]!;
  },

  async countSince(userId: number, since: Date): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM hint_requests WHERE user_id = $1 AND created_at >= $2`,
      [userId, since],
    );
    return Number(result.rows[0]!.count);
  },

  async countForAssignment(userId: number, assignmentId: number): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM hint_requests WHERE user_id = $1 AND assignment_id = $2`,
      [userId, assignmentId],
    );
    return Number(result.rows[0]!.count);
  },

  async findHistory(userId: number, assignmentId?: number, limit = 20): Promise<HintRequestRow[]> {
    const result = assignmentId
      ? await pool.query<HintRequestRow>(
          `SELECT * FROM hint_requests WHERE user_id = $1 AND assignment_id = $2
           ORDER BY created_at DESC LIMIT $3`,
          [userId, assignmentId, limit],
        )
      : await pool.query<HintRequestRow>(
          `SELECT * FROM hint_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [userId, limit],
        );
    return result.rows;
  },
};
