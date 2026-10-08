import { pool } from "@sql-learn/database";

export interface SampleTableRow {
  tableName: string;
  columns: { columnName: string; dataType: string }[];
  rows: Record<string, unknown>[];
}

export interface AssignmentSummaryRow {
  id: number;
  title: string;
  description: string | null;
  difficulty: "easy" | "medium" | "hard";
  created_at: Date;
}

export interface AssignmentPublicRow extends AssignmentSummaryRow {
  question: string;
  sample_tables: SampleTableRow[];
}

export interface AssignmentInternalRow extends AssignmentPublicRow {
  solution_sql: string | null;
}

const PUBLIC_COLUMNS = "id, title, description, difficulty, question, sample_tables, created_at";

export const AssignmentRepository = {
  async listPublished(): Promise<AssignmentSummaryRow[]> {
    const result = await pool.query<AssignmentSummaryRow>(
      `SELECT id, title, description, difficulty, created_at
       FROM assignments
       WHERE is_published = true AND deleted_at IS NULL
       ORDER BY created_at DESC`,
    );
    return result.rows;
  },

  async findPublicById(id: number): Promise<AssignmentPublicRow | null> {
    const result = await pool.query<AssignmentPublicRow>(
      `SELECT ${PUBLIC_COLUMNS}
       FROM assignments
       WHERE id = $1 AND is_published = true AND deleted_at IS NULL`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  async findInternalById(id: number): Promise<AssignmentInternalRow | null> {
    const result = await pool.query<AssignmentInternalRow>(
      `SELECT ${PUBLIC_COLUMNS}, solution_sql
       FROM assignments
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return result.rows[0] ?? null;
  },
};
