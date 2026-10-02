import { fetchAssignments } from "@/services/assignment.service";
import type { AssignmentSummary } from "@sql-learn/types";
import Link from "next/link";

function DifficultyLabel({ difficulty }: { difficulty: AssignmentSummary["difficulty"] }) {
  if (difficulty === "easy") {
    return <span className="text-sm font-medium text-emerald-600">Easy</span>;
  }
  if (difficulty === "medium") {
    return <span className="text-sm font-medium text-amber-500">Med.</span>;
  }
  return <span className="text-sm font-medium text-red-500">Hard</span>;
}

export default async function AssignmentsPage() {
  let assignments: AssignmentSummary[] = [];
  let error = null;

  try {
    assignments = await fetchAssignments();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load assignments";
  }

  // Oldest first so numbering starts at 1 for the earliest problem
  const sorted = [...assignments].reverse();

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Header */}
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-xl font-semibold text-neutral-900">SQL Practice</h1>
          <span className="text-sm text-neutral-400">{assignments.length} problems</span>
        </div>

        {error ? (
          <div className="rounded-md border border-neutral-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-neutral-500">Unable to load assignments — {error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-md border border-neutral-200 bg-white px-6 py-16 text-center">
            <p className="text-sm text-neutral-500">No assignments available yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            {sorted.map((assignment, index) => (
              <Link
                key={assignment.id}
                href={`/assignments/${assignment.id}`}
                className={[
                  "flex items-center gap-4 px-6 py-4 transition-colors hover:bg-blue-50",
                  index !== sorted.length - 1 ? "border-b border-neutral-100" : "",
                  index % 2 === 0 ? "bg-white" : "bg-neutral-50/60",
                ].join(" ")}
              >
                {/* Row number */}
                <span className="w-6 shrink-0 text-right text-sm text-neutral-400">
                  {index + 1}.
                </span>

                {/* Title */}
                <span className="flex-1 text-sm font-medium text-neutral-900">
                  {assignment.title}
                </span>

                {/* Acceptance placeholder */}
                <span className="w-14 shrink-0 text-right text-sm text-neutral-400">—</span>

                {/* Difficulty */}
                <span className="w-10 shrink-0 text-right">
                  <DifficultyLabel difficulty={assignment.difficulty} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
