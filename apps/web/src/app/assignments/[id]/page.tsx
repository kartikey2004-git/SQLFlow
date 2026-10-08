"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { AssignmentDetail, Difficulty, JobStatus } from "@sql-learn/types";
import { fetchAssignmentById } from "@/services/assignment.service";
import { initSandbox, resetSandbox, executeQuery, gradeSubmission } from "@/services/sandbox.service";
import { getHint, HintNotConfiguredError } from "@/services/hint.service";
import { getProgress, updateProgress } from "@/services/progress.service";
import { useAuth } from "@/context/AuthContext";
import { StatementResults } from "@/components/assignments/statement-results";
import { ResetSandboxButton } from "@/components/assignments/reset-sandbox-button";
import Link from "next/link";
import { cn } from "@sql-learn/ui/lib/utils";
import { Button } from "@sql-learn/ui/components/button";
import { Alert, AlertTitle, AlertDescription } from "@sql-learn/ui/components/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@sql-learn/ui/components/table";

const SQLEditor = dynamic(() => import("@/components/editor/SQLEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-neutral-500">
      <Loader2 className="size-4 animate-spin" />
      Loading editor...
    </div>
  ),
});

interface AssignmentPageProps {
  params: Promise<{ id: string }>;
}

type JobPhase = "queued" | "running" | null;

const SAMPLE_ROW_LIMIT = 5;

const difficultyStyles: Record<Difficulty, { label: string; className: string }> = {
  easy: { label: "Easy", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  medium: { label: "Medium", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  hard: { label: "Hard", className: "bg-red-50 text-red-700 ring-red-200" },
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });

const panelClass = "border border-neutral-200 bg-white shadow-sm";
const sectionLabelClass = "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500";

const onJobPhase = (setPhase: (p: JobPhase) => void) => (status: JobStatus) => {
  setPhase(status.state === "active" ? "running" : "queued");
};

const formatCell = (value: unknown) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

function SectionHeader({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3.5">
      <h2 className={sectionLabelClass}>{label}</h2>
      {meta && <span className="font-mono text-[11px] text-neutral-400">{meta}</span>}
    </div>
  );
}

export default function AssignmentPage({ params }: AssignmentPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(true);
  const [sandboxReady, setSandboxReady] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  const [sqlQuery, setSqlQuery] = useState("");
  const [executePhase, setExecutePhase] = useState<JobPhase>(null);
  const [gradePhase, setGradePhase] = useState<JobPhase>(null);
  const [hintNotConfigured, setHintNotConfigured] = useState(false);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [seededForAssignmentId, setSeededForAssignmentId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      params.then(({ id }) => router.replace(`/login?next=/assignments/${id}`));
    }
  }, [authLoading, user, params, router]);

  useEffect(() => {
    params.then((resolved) => setAssignmentId(Number(resolved.id)));
  }, [params]);

  const assignmentQuery = useQuery<AssignmentDetail, Error>({
    queryKey: ["assignment", assignmentId],
    queryFn: () => fetchAssignmentById(assignmentId!),
    enabled: assignmentId !== null,
  });
  const assignment = assignmentQuery.data ?? null;

  const progressQuery = useQuery({
    queryKey: ["progress", assignment?.id],
    queryFn: () => getProgress(assignment!.id),
    enabled: Boolean(assignment) && Boolean(user),
  });

  if (
    progressQuery.data?.lastQuery &&
    assignment &&
    seededForAssignmentId !== assignment.id
  ) {
    setSqlQuery(progressQuery.data.lastQuery);
    setSeededForAssignmentId(assignment.id);
  }

  useEffect(() => {
    if (!assignment || !user) return;
    let cancelled = false;
    (async () => {
      try {
        setSandboxLoading(true);
        await initSandbox(assignment.id);
        if (cancelled) return;
        setSandboxReady(true);
      } catch (err) {
        if (cancelled) return;
        setSandboxError(err instanceof Error ? err.message : "Failed to initialize workspace");
      } finally {
        if (!cancelled) setSandboxLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignment, user]);

  const updateProgressMutation = useMutation({
    mutationFn: (updates: Parameters<typeof updateProgress>[1]) => updateProgress(assignment!.id, updates),
    onSuccess: (data) => {
      queryClient.setQueryData(["progress", assignment?.id], data);
    },
    onError: (err) => console.error("Failed to update progress:", err),
  });

  useEffect(() => {
    if (!autoSaveEnabled || !assignment || !sqlQuery.trim() || !user) return;
    const timeout = setTimeout(() => {
      updateProgressMutation.mutate({ lastQuery: sqlQuery });
    }, 2000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlQuery, autoSaveEnabled, assignment, user]);

  const executeMutation = useMutation({
    mutationFn: (query: string) => executeQuery(assignment!.id, query, onJobPhase(setExecutePhase)),
  });

  const gradeMutation = useMutation({
    mutationFn: (query: string) => gradeSubmission(assignment!.id, query, onJobPhase(setGradePhase)),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetSandbox(assignment!.id),
    onSuccess: () => {
      executeMutation.reset();
      gradeMutation.reset();
      setSandboxError(null);
      setSandboxReady(true);
      queryClient.invalidateQueries({ queryKey: ["progress", assignment?.id] });
    },
  });

  const hintMutation = useMutation({
    mutationFn: (query: string) => getHint(assignment!.id, query),
  });

  const handleExecuteQuery = () => {
    if (!sqlQuery.trim() || !assignment) return;
    gradeMutation.reset();
    setExecutePhase("queued");
    executeMutation.mutate(sqlQuery, {
      onSuccess: () => {
        updateProgressMutation.mutate({ lastQuery: sqlQuery, incrementAttempt: true });
      },
      onSettled: () => setExecutePhase(null),
    });
  };

  const handleGradeSubmission = () => {
    if (!sqlQuery.trim() || !assignment) return;
    executeMutation.reset();
    setGradePhase("queued");
    gradeMutation.mutate(sqlQuery, {
      onSuccess: (result) => {
        updateProgressMutation.mutate({
          lastQuery: sqlQuery,
          incrementAttempt: true,
        });
        if (result.passed) queryClient.invalidateQueries({ queryKey: ["progress", assignment.id] });
      },
      onSettled: () => setGradePhase(null),
    });
  };

  const handleGetHint = () => {
    if (!sqlQuery.trim() || !assignment) return;
    setHintNotConfigured(false);
    hintMutation.mutate(sqlQuery, {
      onError: (err) => {
        if (err instanceof HintNotConfiguredError) setHintNotConfigured(true);
      },
    });
  };

  const dismissHint = useCallback(() => {
    hintMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = assignmentId === null || assignmentQuery.isLoading;
  const pageError = assignmentQuery.error?.message ?? sandboxError;

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-500">
        Loading assignment...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (pageError || !assignment) {
    return (
      <div className="min-h-screen bg-neutral-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/assignments"
            className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            Back to assignments
          </Link>
          {pageError ? (
            <Alert variant="destructive">
              <AlertDescription>{pageError}</AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-neutral-500">Assignment not found.</p>
          )}
        </div>
      </div>
    );
  }

  const jobPhaseLabel = (phase: JobPhase) => (phase === "running" ? "Running..." : "Queued...");
  const hint = hintMutation.data?.hintText ?? null;
  const hintError =
    hintMutation.error && !(hintMutation.error instanceof HintNotConfiguredError)
      ? hintMutation.error.message
      : null;
  const queryResult = executeMutation.data ?? null;
  const queryError = executeMutation.error?.message ?? null;
  const resetError = resetMutation.error?.message ?? null;
  const gradingResult = gradeMutation.data ?? null;
  const gradingError = gradeMutation.error?.message ?? null;
  const progress = progressQuery.data
    ? { attemptCount: progressQuery.data.attemptCount, isCompleted: progressQuery.data.isCompleted }
    : null;
  const hasResults = Boolean(
    queryResult || queryError || resetError || gradingResult || gradingError || hint || hintError || hintNotConfigured,
  );

  const visibleTests = assignment.testCases.filter((test) => !test.isHidden);
  const hiddenTestCount = assignment.testCases.length - visibleTests.length;
  const difficulty = difficultyStyles[assignment.difficulty];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      {}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-6 py-3.5">
        <Link
          href="/assignments"
          className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Back to Assignments
        </Link>

        <div className="text-sm">
          {sandboxLoading ? (
            <div className="flex items-center gap-2 text-neutral-500">
              <Loader2 className="size-4 animate-spin" />
              Getting things ready...
            </div>
          ) : sandboxReady ? (
            <div className="flex items-center gap-2.5 text-neutral-600" role="status">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
              Ready to run queries
            </div>
          ) : (
            <span className="text-red-600" role="alert">
              Couldn&apos;t get this problem ready. Refresh the page to try again.
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        {}
        <section className="flex flex-col gap-5 border-b border-neutral-200 pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                difficulty.className,
              )}
            >
              {difficulty.label}
            </span>
            <span className="font-mono text-xs text-neutral-400">
              Added {dateFormatter.format(new Date(assignment.createdAt))}
            </span>
            {progress && (
              <>
                <span className="font-mono text-xs text-neutral-400">
                  {progress.attemptCount} attempt{progress.attemptCount === 1 ? "" : "s"}
                </span>
                {progress.isCompleted && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 bg-emerald-50">
                    Completed
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">{assignment.title}</h1>
            {assignment.description && (
              <p className="max-w-3xl text-base leading-relaxed text-neutral-600">{assignment.description}</p>
            )}
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          {}
          <div className="flex flex-col gap-6">
            <section className={panelClass}>
              <SectionHeader label="Problem" />
              <p className="whitespace-pre-line px-5 py-5 text-sm leading-7 text-neutral-800">{assignment.question}</p>
            </section>

            <section className={panelClass}>
              <SectionHeader
                label="Test cases"
                meta={`${visibleTests.length} visible · ${hiddenTestCount} hidden`}
              />
              {assignment.testCases.length === 0 ? (
                <p className="px-5 py-5 text-sm text-neutral-500">No test cases for this assignment.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {assignment.testCases.map((test, index) => (
                    <li key={test.id} className="flex items-start justify-between gap-4 px-5 py-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm font-medium text-neutral-900">
                          {test.name ?? `Test case ${index + 1}`}
                        </span>
                        {test.isHidden ? (
                          <span className="text-xs text-neutral-500">Expected output is hidden until you submit.</span>
                        ) : test.expectedOutput ? (
                          <span className="break-all font-mono text-xs text-neutral-600">
                            {test.expectedOutput.type}: {formatCell(test.expectedOutput.value)}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                          test.isHidden
                            ? "bg-neutral-100 text-neutral-600 ring-neutral-200"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                        )}
                      >
                        {test.isHidden ? "Hidden" : "Visible"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={panelClass}>
              <SectionHeader
                label="Database"
                meta={`${assignment.sampleTables?.length ?? 0} table${(assignment.sampleTables?.length ?? 0) === 1 ? "" : "s"}`}
              />
              {assignment.sampleTables && assignment.sampleTables.length > 0 ? (
                <div className="flex flex-col divide-y divide-neutral-100">
                  {assignment.sampleTables.map((table) => (
                    <div key={table.tableName} className="flex flex-col gap-4 px-5 py-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-mono text-sm font-semibold text-neutral-900">{table.tableName}</h3>
                        <span className="font-mono text-[11px] text-neutral-400">
                          {table.rows.length} row{table.rows.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <ul className="grid grid-cols-1 gap-px bg-neutral-200 border border-neutral-200 sm:grid-cols-2">
                        {table.columns.map((column) => (
                          <li
                            key={column.columnName}
                            className="flex items-center justify-between gap-3 bg-white px-3 py-2"
                          >
                            <span className="font-mono text-xs text-neutral-800">{column.columnName}</span>
                            <span className="font-mono text-[11px] text-neutral-400">{column.dataType}</span>
                          </li>
                        ))}
                      </ul>

                      {table.rows.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="overflow-x-auto border border-neutral-200">
                            <Table>
                              <TableHeader className="bg-neutral-50">
                                <TableRow>
                                  {table.columns.map((column) => (
                                    <TableHead key={column.columnName} className="font-mono text-xs">
                                      {column.columnName}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {table.rows.slice(0, SAMPLE_ROW_LIMIT).map((row, rowIndex) => (
                                  <TableRow key={rowIndex}>
                                    {table.columns.map((column) => (
                                      <TableCell key={column.columnName} className="font-mono text-xs">
                                        {formatCell(row[column.columnName])}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          {table.rows.length > SAMPLE_ROW_LIMIT && (
                            <span className="text-xs text-neutral-400">
                              Showing {SAMPLE_ROW_LIMIT} of {table.rows.length} rows.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-5 text-sm text-neutral-500">No schema available for this assignment.</p>
              )}
            </section>
          </div>

          {}
          <div className="flex flex-col gap-6 lg:sticky lg:top-20">
            <section className={cn(panelClass, "overflow-hidden")}>
              <SectionHeader label="SQL Editor" />
              <div className="flex flex-col gap-4 p-5">
                <div className="h-[300px] overflow-hidden border border-neutral-200 transition-colors focus-within:border-emerald-600 focus-within:ring-[3px] focus-within:ring-emerald-600/15">
                  <SQLEditor
                    value={sqlQuery}
                    onChange={setSqlQuery}
                    onRun={handleExecuteQuery}
                    disabled={!sandboxReady || resetMutation.isPending || executeMutation.isPending || resetMutation.isPending}
                    placeholder="Write your SQL query here..."
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={handleGetHint}
                    disabled={
                      !sandboxReady || resetMutation.isPending ||
                      hintMutation.isPending ||
                      executeMutation.isPending ||
                      gradeMutation.isPending ||
                      !sqlQuery.trim()
                    }
                    className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  >
                    {hintMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Getting hint...
                      </>
                    ) : (
                      "Get hint"
                    )}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={handleExecuteQuery}
                      disabled={
                        !sandboxReady || resetMutation.isPending || executeMutation.isPending || gradeMutation.isPending || !sqlQuery.trim()
                      }
                    >
                      {executeMutation.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {jobPhaseLabel(executePhase)}
                        </>
                      ) : (
                        "Run query"
                      )}
                    </Button>
                    <Button
                      variant="success"
                      onClick={handleGradeSubmission}
                      disabled={
                        !sandboxReady || resetMutation.isPending || gradeMutation.isPending || executeMutation.isPending || !sqlQuery.trim()
                      }
                    >
                      {gradeMutation.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {jobPhaseLabel(gradePhase)}
                        </>
                      ) : (
                        "Submit"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4 text-sm text-neutral-500">
                  <ResetSandboxButton
                    resetting={resetMutation.isPending}
                    disabled={
                      !sandboxReady || executeMutation.isPending || gradeMutation.isPending
                    }
                    onReset={() => resetMutation.mutate()}
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoSaveEnabled}
                      onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                      className="size-4 border-neutral-300 accent-emerald-600"
                    />
                    Auto-save query
                  </label>
                </div>
              </div>
            </section>

            {hasResults && (
              <section className={panelClass}>
                <SectionHeader label="Results" />
                <div className="flex flex-col gap-4 p-5">
                  {hint ? (
                    <Alert variant="warning">
                      <AlertTitle className="flex items-center justify-between">
                        Hint
                        <button
                          onClick={dismissHint}
                          className="text-lg leading-none text-amber-hint-700 hover:text-amber-hint-900"
                          aria-label="Dismiss hint"
                        >
                          ×
                        </button>
                      </AlertTitle>
                      <AlertDescription>{hint}</AlertDescription>
                    </Alert>
                  ) : hintNotConfigured ? (
                    <Alert variant="destructive">
                      <AlertTitle>Hints unavailable</AlertTitle>
                      <AlertDescription>AI hints aren&apos;t configured on this server yet.</AlertDescription>
                    </Alert>
                  ) : hintError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Hint error</AlertTitle>
                      <AlertDescription>{hintError}</AlertDescription>
                    </Alert>
                  ) : gradingError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Grading error</AlertTitle>
                      <AlertDescription>{gradingError}</AlertDescription>
                    </Alert>
                  ) : gradingResult ? (
                    <div className="flex flex-col gap-4">
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-4 border p-4 text-sm",
                          gradingResult.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50",
                        )}
                      >
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                            gradingResult.passed
                              ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                              : "bg-red-100 text-red-800 ring-red-300",
                          )}
                        >
                          {gradingResult.passed ? "Passed" : "Failed"}
                        </span>
                        <span className="font-medium text-neutral-800">Score {gradingResult.score}%</span>
                        <span className="font-mono text-xs text-neutral-500">{gradingResult.executionTime} ms</span>
                      </div>
                      {gradingResult.statements && gradingResult.statements.length > 0 && (
                        <StatementResults
                          statements={gradingResult.statements}
                          aborted={gradingResult.statements.some((st) => st.error)}
                        />
                      )}
                      {gradingResult.results
                        .filter((r) => !r.isHidden && r.reason)
                        .map((r) => (
                          <p key={r.testCaseId} className="text-sm text-neutral-700">
                            <span className="font-medium text-neutral-900">Reason:</span> {r.reason}
                          </p>
                        ))}
                      {gradingResult.results.some((r) => r.isHidden) && (
                        <p className="text-sm text-neutral-500">
                          Plus {gradingResult.results.filter((r) => r.isHidden).length} hidden test case(s).
                        </p>
                      )}
                    </div>
                  ) : resetError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Reset failed</AlertTitle>
                      <AlertDescription>{resetError}</AlertDescription>
                    </Alert>
                  ) : queryError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{queryError}</AlertDescription>
                    </Alert>
                  ) : queryResult ? (
                    <StatementResults
                      statements={queryResult.statements}
                      aborted={queryResult.aborted}
                      executionTime={queryResult.executionTime}
                    />
                  ) : null}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
