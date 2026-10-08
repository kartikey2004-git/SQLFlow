import { fetchAssignments } from "@/services/assignment.service";
import { AssignmentBrowser } from "@/components/assignments/assignment-browser";
import type { AssignmentSummary } from "@sql-learn/types";

export default async function AssignmentsPage() {
  let assignments: AssignmentSummary[] = [];
  let error = null;

  try {
    assignments = await fetchAssignments();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load assignments";
  }

  const sorted = [...assignments].reverse();

  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const assignment of assignments) {
    counts[assignment.difficulty] += 1;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-700">Practice</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">SQL Practice</h1>
            <p className="mt-2 text-sm text-neutral-500">Problems run from the first to the latest.</p>
          </div>
          <span className="font-mono text-sm text-neutral-400">{assignments.length} problems</span>
        </header>

        {!error && sorted.length > 0 && (
          <div className="mb-8 grid grid-cols-3 gap-px overflow-hidden border border-neutral-200 bg-neutral-200">
            {(["easy", "medium", "hard"] as const).map((level) => (
              <div key={level} className="flex flex-col gap-1 bg-white px-5 py-4">
                <span className="text-xs uppercase tracking-wider text-neutral-500">
                  {level === "easy" ? "Easy" : level === "medium" ? "Medium" : "Hard"}
                </span>
                <span className="text-2xl font-semibold tabular-nums text-neutral-900">{counts[level]}</span>
              </div>
            ))}
          </div>
        )}

        {error ? (
          <div className="border border-red-200 bg-red-50 px-6 py-10 text-center">
            <p className="text-sm text-red-700">Unable to load assignments: {error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="border border-neutral-200 bg-white px-6 py-16 text-center">
            <p className="text-sm text-neutral-500">No assignments available yet.</p>
          </div>
        ) : (
          <AssignmentBrowser assignments={sorted} />
        )}
      </div>
    </div>
  );
}
