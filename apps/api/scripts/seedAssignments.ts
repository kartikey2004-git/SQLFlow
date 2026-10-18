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
  description: string; // holds the difficulty level in the seed JSON
  question: string;
  sampleTables: SeedTable[];
  expectedOutput: { type: string; value: unknown };
}

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const resolveDifficulty = (raw: string): string => {
  const normalized = raw.trim().toLowerCase();
  return VALID_DIFFICULTIES.has(normalized) ? normalized : "medium";
};

const seedAssignments = async () => {
  const client = await pool.connect();

  try {
    console.log(`Seeding ${assignmentsData.length} assignments...`);

    for (const assignment of assignmentsData as SeedAssignment[]) {
      const difficulty = resolveDifficulty(assignment.description);

      await client.query("BEGIN");
      try {
        // Requires the partial unique index on (title) WHERE deleted_at IS NULL.
        const upserted = await client.query<{ id: string }>(
          `INSERT INTO assignments (title, question, difficulty, sample_tables)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (title) WHERE deleted_at IS NULL
           DO UPDATE SET
             question      = EXCLUDED.question,
             difficulty    = EXCLUDED.difficulty,
             sample_tables = EXCLUDED.sample_tables,
             updated_at    = now()
           RETURNING id`,
          [
            assignment.title,
            assignment.question,
            difficulty,
            JSON.stringify(assignment.sampleTables),
          ],
        );
        const assignmentId = upserted.rows[0]?.id;
        if (!assignmentId) throw new Error(`Upsert returned no id for "${assignment.title}"`);

        // Replace test cases so re-runs don't accumulate them.
        await client.query(`DELETE FROM test_cases WHERE assignment_id = $1`, [
          assignmentId,
        ]);
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

    if (process.env.PRUNE === "1") {
      // Soft-delete (not DELETE) so attempts/hint_requests that reference old assignments survive.
      const titles = (assignmentsData as SeedAssignment[]).map((a) => a.title);
      const pruned = await client.query<{ title: string }>(
        `UPDATE assignments
            SET deleted_at = now(), updated_at = now()
          WHERE deleted_at IS NULL AND NOT (title = ANY($1::text[]))
        RETURNING title`,
        [titles],
      );
      for (const row of pruned.rows) console.log(`Pruned: ${row.title}`);
      console.log(`Pruned ${pruned.rowCount} assignments not in seed data`);
    }

    console.log("All assignments seeded successfully");

    // Tell the web app to drop its cached /assignments page. Best effort: the seed already succeeded.
    const revalidateUrl = process.env.WEB_REVALIDATE_URL;
    const revalidateSecret = process.env.REVALIDATE_SECRET;
    if (revalidateUrl && revalidateSecret) {
      try {
        const res = await fetch(revalidateUrl, {
          method: "POST",
          headers: { "x-revalidate-secret": revalidateSecret },
        });
        console.log(`Web cache revalidate: ${res.status}`);
      } catch (error) {
        console.warn("Web cache revalidate failed:", error);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
};

seedAssignments().catch((error) => {
  console.error("Error seeding assignments:", error);
  process.exitCode = 1;
});