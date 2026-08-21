import { fetchAssignments } from "@/services/assignment.service";
import type { AssignmentSummary } from "@sql-learn/types";
import Link from "next/link";
import { Card } from "@sql-learn/ui/components/card";
import { Badge } from "@sql-learn/ui/components/badge";

export default async function AssignmentsPage() {
  let assignments: AssignmentSummary[] = [];
  let error = null;

  try {
    assignments = await fetchAssignments();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load assignments";
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="border-b border-neutral-200 pt-12 pb-8">
            <h1 className="text-[2.5rem] font-semibold tracking-tight">SQL Practice</h1>
            <p className="mt-3 text-lg text-neutral-500">Master SQL with hands-on exercises</p>
          </div>
          <Card className="mt-8 flex items-center gap-6 p-8">
            <div className="text-3xl opacity-70">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold">Unable to load assignments</h3>
              <p className="text-sm text-neutral-500">{error}</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="flex flex-col items-start gap-8 border-b border-neutral-200 pt-10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.5rem]">SQL Practice</h1>
            <p className="mt-3 text-lg text-neutral-500">
              Master SQL with interactive exercises and real-time feedback
            </p>
          </div>
          <div className="flex w-full gap-4 sm:w-auto">
            <Card className="min-w-[120px] flex-1 p-6 text-center transition-colors hover:border-neutral-300 hover:shadow-md sm:flex-none">
              <div className="font-mono text-2xl font-semibold">{assignments.length}</div>
              <div className="mt-2 text-sm font-medium tracking-wide text-neutral-500 uppercase">
                Exercises
              </div>
            </Card>
            <Card className="min-w-[120px] flex-1 p-6 text-center transition-colors hover:border-neutral-300 hover:shadow-md sm:flex-none">
              <div className="font-mono text-2xl font-semibold">&#8734;</div>
              <div className="mt-2 text-sm font-medium tracking-wide text-neutral-500 uppercase">
                Attempts
              </div>
            </Card>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-16 text-center">
            <div className="mb-6 text-5xl opacity-50">📝</div>
            <h2 className="text-2xl font-semibold">No assignments available yet</h2>
            <p className="mt-3 text-sm text-neutral-500">Check back later for new SQL exercises</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 pb-16 sm:grid-cols-[repeat(auto-fill,minmax(350px,1fr))] sm:gap-6">
            {assignments.map((assignment) => (
              <Link
                key={assignment.id}
                href={`/assignments/${assignment.id}`}
                className="group block h-full"
              >
                <Card className="h-full p-6 transition-all hover:border-neutral-300 hover:shadow-lg">
                  <div className="flex flex-1 flex-col">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-sm font-medium text-neutral-400">
                        #{assignment.id}
                      </span>
                      <Badge variant="outline" className="uppercase tracking-wide">
                        {assignment.difficulty}
                      </Badge>
                    </div>
                    <h3 className="mb-3 text-xl font-semibold">{assignment.title}</h3>
                    <p className="flex-1 text-sm text-neutral-500">
                      {assignment.description ||
                        "Practice your SQL skills with this exercise"}
                    </p>
                    <div className="mt-6 flex justify-end border-t border-neutral-100 pt-4">
                      <span className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-500 transition-colors group-hover:border-neutral-300 group-hover:bg-neutral-50 group-hover:text-neutral-900">
                        Start Exercise
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="transition-transform group-hover:translate-x-0.5"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
