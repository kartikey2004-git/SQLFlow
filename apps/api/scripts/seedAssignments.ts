import "dotenv/config";
import { pool } from "@sql-learn/database";
import assignmentsData from "../data/assignments.json";

interface SeedTable {
  tableName: string;
  columns: { columnName: string; dataType: string }[];
  rows: Record<string, unknown>[];
}

interface SeedAssignment {
  title: string;
  description: string; // historically used as a difficulty label in this seed file
  question: string;
  sampleTables: SeedTable[];
  expectedOutput: { type: string; value: unknown };
}

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const seedAssignments = async () => {
  const client = await pool.connect();

  try {
    console.log(`Seeding ${assignmentsData.length} assignments...`);

    for (const assignment of assignmentsData as SeedAssignment[]) {
      const difficulty = VALID_DIFFICULTIES.has(assignment.description.toLowerCase())
        ? assignment.description.toLowerCase()
        : "medium";

      await client.query("BEGIN");
      try {
        const assignmentResult = await client.query(
          `INSERT INTO assignments (title, question, difficulty, sample_tables)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [assignment.title, assignment.question, difficulty, JSON.stringify(assignment.sampleTables)],
        );

        let assignmentId: number;
        if (assignmentResult.rows.length > 0) {
          assignmentId = assignmentResult.rows[0].id;
        } else {
          const existing = await client.query(
            `SELECT id FROM assignments WHERE title = $1`,
            [assignment.title],
          );
          assignmentId = existing.rows[0].id;

          // Keep re-seeding idempotent: refresh the schema/question on re-run.
          await client.query(
            `UPDATE assignments SET question = $2, difficulty = $3, sample_tables = $4
             WHERE id = $1`,
            [assignmentId, assignment.question, difficulty, JSON.stringify(assignment.sampleTables)],
          );
          await client.query(`DELETE FROM test_cases WHERE assignment_id = $1`, [assignmentId]);
        }

        await client.query(
          `INSERT INTO test_cases (assignment_id, name, expected_output_type, expected_output, is_hidden, order_index)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            assignmentId,
            "Sample case",
            assignment.expectedOutput.type,
            JSON.stringify(assignment.expectedOutput.value),
            false,
            0,
          ],
        );

        await client.query("COMMIT");
        console.log(`Seeded: ${assignment.title}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("All assignments seeded successfully");
  } finally {
    client.release();
    await pool.end();
  }
};

seedAssignments().catch((error) => {
  console.error("Error seeding assignments:", error);
  process.exitCode = 1;
});
