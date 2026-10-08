"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, X } from "lucide-react";
import type { AssignmentSummary } from "@sql-learn/types";

type Difficulty = AssignmentSummary["difficulty"];
type Filter = "all" | Difficulty;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const difficultyStyles: Record<Difficulty, { label: string; className: string }> = {
  easy: { label: "Easy", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  medium: { label: "Medium", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  hard: { label: "Hard", className: "bg-red-50 text-red-700 ring-red-200" },
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });

function DifficultyPill({ difficulty }: { difficulty: Difficulty }) {
  const style = difficultyStyles[difficulty];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}>
      {style.label}
    </span>
  );
}

export function AssignmentBrowser({ assignments }: { assignments: AssignmentSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const numberById = useMemo(
    () => new Map(assignments.map((assignment, index) => [assignment.id, index + 1])),
    [assignments],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assignments.filter((assignment) => {
      if (filter !== "all" && assignment.difficulty !== filter) return false;
      if (!needle) return true;
      return (
        assignment.title.toLowerCase().includes(needle) ||
        (assignment.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [assignments, query, filter]);

  const hasActiveFilters = query.trim() !== "" || filter !== "all";

  const clearFilters = () => {
    setQuery("");
    setFilter("all");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="relative w-full md:max-w-sm">
          <span className="sr-only">Search problems</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or description"
            className="h-10 w-full border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-emerald-600 focus:ring-[3px] focus:ring-emerald-600/15"
          />
        </label>

        <div role="group" aria-label="Filter by difficulty" className="flex items-center gap-1 border border-neutral-200 bg-white p-1">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={
                filter === item.value
                  ? "bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
                  : "px-3 py-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          Showing <span className="font-medium text-neutral-900">{visible.length}</span> of {assignments.length}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-neutral-500 transition-colors hover:text-neutral-900"
          >
            <X className="size-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-neutral-500">No problems match your search.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Reset search and filters
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((assignment) => (
            <li key={assignment.id} className="flex">
              <Link
                href={`/assignments/${assignment.id}`}
                className="group flex w-full flex-col gap-4 border border-neutral-200 bg-white p-6 shadow-sm transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-neutral-400">
                    {String(numberById.get(assignment.id) ?? 0).padStart(2, "0")}
                  </span>
                  <DifficultyPill difficulty={assignment.difficulty} />
                </div>

                <h2 className="text-base font-semibold text-neutral-900 group-hover:text-emerald-800">
                  {assignment.title}
                </h2>

                <p className="text-sm leading-relaxed text-neutral-600">
                  {assignment.description ?? "No description provided."}
                </p>

                <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-4">
                  <span className="font-mono text-[11px] text-neutral-400">
                    Added {dateFormatter.format(new Date(assignment.createdAt))}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                    Open
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
