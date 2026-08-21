"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { AssignmentDetail, JobStatus } from "@sql-learn/types";
import { fetchAssignmentById } from "@/services/assignment.service";
import { initSandbox, executeQuery, gradeSubmission } from "@/services/sandbox.service";
import { getHint, HintNotConfiguredError } from "@/services/hint.service";
import { getProgress, updateProgress } from "@/services/progress.service";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { cn } from "@sql-learn/ui/lib/utils";
import { Card } from "@sql-learn/ui/components/card";
import { Badge } from "@sql-learn/ui/components/badge";
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

// Card surfaces across this workspace share a "frosted glass" translucent
// look with a hover elevation lift (ported from assignment-detail.scss's
// `card-base` mixin, which composed `frosted-glass(0.8)` + `hover-lift`).
const cardBaseClass =
  "border-neutral-200/60 bg-white/80 shadow-sm backdrop-blur-sm transition-shadow duration-150 hover:border-neutral-300/80 hover:shadow-md";

const onJobPhase = (setPhase: (p: JobPhase) => void) => (status: JobStatus) => {
  setPhase(status.state === "active" ? "running" : "queued");
};

export default function AssignmentPage({ params }: AssignmentPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(true);
  const [sandboxReady, setSandboxReady] = useState(false);
  const [sandboxInfo, setSandboxInfo] = useState<{ schemaName: string; isNew: boolean } | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  const [sqlQuery, setSqlQuery] = useState("");
  const [executePhase, setExecutePhase] = useState<JobPhase>(null);
  const [gradePhase, setGradePhase] = useState<JobPhase>(null);
  const [hintNotConfigured, setHintNotConfigured] = useState(false);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  // Tracks which assignment's lastQuery has already been seeded into the
  // editor, so the seed happens exactly once per assignment - not on every
  // later progress refetch (e.g. after a save), which would otherwise
  // clobber in-progress edits. Set via the render-time "adjusting state"
  // pattern (React's own recommended escape hatch - see "You Might Not
  // Need An Effect") rather than an effect, since ESLint's
  // react-hooks/set-state-in-effect rule flags a synchronous setState
  // inside an effect body for exactly this kind of derived-state sync.
  const [seededForAssignmentId, setSeededForAssignmentId] = useState<number | null>(null);

  // Redirect unauthenticated visitors to log in, then back here.
  useEffect(() => {
    if (!authLoading && !user) {
      params.then(({ id }) => router.replace(`/login?next=/assignments/${id}`));
    }
  }, [authLoading, user, params, router]);

  useEffect(() => {
    params.then((resolved) => setAssignmentId(Number(resolved.id)));
  }, [params]);

  // Interactive server state (spec: assignment data, progress, execution
  // status, grading, hints are the "good candidates" for TanStack Query -
  // the read-heavy assignment *list* stays a Server Component).
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

  // Adjusting state during render (React's documented pattern for "when a
  // prop/query result changes, derive state from it once") instead of an
  // effect - see the comment on seededForAssignmentId above.
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
        const result = await initSandbox(assignment.id);
        if (cancelled) return;
        setSandboxInfo(result);
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
    // updateProgressMutation is intentionally omitted: it's a new object
    // every render (useMutation doesn't memoize it), and only sqlQuery
    // changing should reset this debounce timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlQuery, autoSaveEnabled, assignment, user]);

  const executeMutation = useMutation({
    mutationFn: (query: string) => executeQuery(assignment!.id, query, onJobPhase(setExecutePhase)),
  });

  const gradeMutation = useMutation({
    mutationFn: (query: string) => gradeSubmission(assignment!.id, query, onJobPhase(setGradePhase)),
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
          markCompleted: result.passed,
        });
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
    return null; // redirect effect is already navigating away
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-neutral-50 p-6">
        <Link
          href="/assignments"
          className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Back to assignments
        </Link>
        <Alert variant="destructive">
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-neutral-50 p-6">
        <Link
          href="/assignments"
          className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Back to assignments
        </Link>
        <p className="text-sm text-neutral-500">Assignment not found.</p>
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
  const gradingResult = gradeMutation.data ?? null;
  const gradingError = gradeMutation.error?.message ?? null;
  const progress = progressQuery.data
    ? { attemptCount: progressQuery.data.attemptCount, isCompleted: progressQuery.data.isCompleted }
    : null;
  const hasResults = Boolean(
    queryResult || queryError || gradingResult || gradingError || hint || hintError || hintNotConfigured,
  );

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      {/* Header */}
      <div
        className={cn(
          "sticky top-0 z-20 flex items-center justify-between border-b px-6 py-4",
          cardBaseClass,
          "rounded-none shadow-none hover:shadow-none",
        )}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/assignments"
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
          >
            ← Back to assignments
          </Link>
          <h1 className="text-lg font-semibold text-neutral-900">{assignment.title}</h1>
        </div>
        <div>
          {sandboxLoading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" />
              Initializing...
            </div>
          ) : sandboxReady ? (
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Badge variant="success">✓ Ready</Badge>
              <span>{sandboxInfo?.schemaName}</span>
              {sandboxInfo?.isNew && <Badge variant="outline">New</Badge>}
            </div>
          ) : (
            <Badge variant="destructive">✗ Failed to initialize</Badge>
          )}
        </div>
      </div>

      {/* Content grid */}
      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[380px_1fr]">
        {/* Left panel */}
        <div className="flex flex-col gap-6">
          <Card className={cn(cardBaseClass, "p-6")}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">
              Problem
            </h2>
            <p className="text-sm leading-relaxed text-neutral-900">{assignment.question}</p>
          </Card>

          <Card className={cn(cardBaseClass, "p-6")}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">
              Database Schema
            </h2>
            {assignment.sampleTables && assignment.sampleTables.length > 0 ? (
              <div className="flex flex-col gap-4">
                {assignment.sampleTables.map((table, index) => (
                  <div key={index} className="rounded-md border border-neutral-200 p-3">
                    <h3 className="mb-2 font-mono text-sm font-semibold text-neutral-900">
                      {table.tableName}
                    </h3>
                    <ul className="flex flex-col gap-1">
                      {table.columns.map((column, colIndex) => (
                        <li
                          key={colIndex}
                          className="flex items-center justify-between border-t border-neutral-100 py-1 text-xs first:border-t-0"
                        >
                          <span className="font-mono text-neutral-700">{column.columnName}</span>
                          <span className="text-neutral-400">{column.dataType}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No schema available for this assignment.</p>
            )}
          </Card>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-6">
          <Card className={cn(cardBaseClass, "gap-0 overflow-hidden p-0")}>
            <h2 className="border-b border-neutral-100 px-6 py-4 text-sm font-semibold tracking-wide text-neutral-500 uppercase">
              SQL Editor
            </h2>
            <div className="flex flex-col gap-4 p-6">
              <div className="h-[300px] overflow-hidden rounded-md border border-neutral-200 focus-within:border-blue-600 focus-within:ring-[3px] focus-within:ring-blue-600/10">
                <SQLEditor
                  value={sqlQuery}
                  onChange={setSqlQuery}
                  disabled={!sandboxReady || executeMutation.isPending}
                  placeholder="Write your SQL query here..."
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Button
                  onClick={handleGetHint}
                  disabled={
                    !sandboxReady ||
                    hintMutation.isPending ||
                    executeMutation.isPending ||
                    gradeMutation.isPending ||
                    !sqlQuery.trim()
                  }
                  className="bg-gradient-to-r from-amber-hint-500 to-amber-hint-600 text-white hover:opacity-90"
                >
                  {hintMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Getting Hint...
                    </>
                  ) : (
                    "💡 Get Hint"
                  )}
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleExecuteQuery}
                    disabled={
                      !sandboxReady || executeMutation.isPending || gradeMutation.isPending || !sqlQuery.trim()
                    }
                  >
                    {executeMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {jobPhaseLabel(executePhase)}
                      </>
                    ) : (
                      "Run Query"
                    )}
                  </Button>
                  <Button
                    variant="success"
                    onClick={handleGradeSubmission}
                    disabled={
                      !sandboxReady || gradeMutation.isPending || executeMutation.isPending || !sqlQuery.trim()
                    }
                  >
                    {gradeMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {jobPhaseLabel(gradePhase)}
                      </>
                    ) : (
                      "Run & Submit"
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-4 text-sm text-neutral-500">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                    className="size-4 rounded border-neutral-300 accent-blue-600"
                  />
                  Auto-save query
                </label>
                {progress && (
                  <span>
                    Attempts: {progress.attemptCount}
                    {progress.isCompleted && " ✅"}
                  </span>
                )}
              </div>
            </div>
          </Card>

          {hasResults && (
            <Card className={cn(cardBaseClass, "gap-4 p-6")}>
              <h2 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
                Results
              </h2>

              {hint ? (
                <Alert variant="warning">
                  <AlertTitle className="flex items-center justify-between">
                    💡 Hint
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
                  <AlertDescription>
                    AI hints aren&apos;t configured on this server yet.
                  </AlertDescription>
                </Alert>
              ) : hintError ? (
                <Alert variant="destructive">
                  <AlertTitle>Hint Error</AlertTitle>
                  <AlertDescription>{hintError}</AlertDescription>
                </Alert>
              ) : gradingError ? (
                <Alert variant="destructive">
                  <AlertTitle>Grading Error</AlertTitle>
                  <AlertDescription>{gradingError}</AlertDescription>
                </Alert>
              ) : gradingResult ? (
                <div className="flex flex-col gap-3">
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-4 rounded-md border p-4 text-sm",
                      gradingResult.passed
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50",
                    )}
                  >
                    <Badge variant={gradingResult.passed ? "success" : "destructive"}>
                      {gradingResult.passed ? "✅ Passed" : "❌ Failed"}
                    </Badge>
                    <span className="text-neutral-700">Score: {gradingResult.score}%</span>
                    <span className="text-neutral-500">{gradingResult.executionTime}ms</span>
                  </div>
                  {gradingResult.results
                    .filter((r) => !r.isHidden && r.reason)
                    .map((r) => (
                      <p key={r.testCaseId} className="text-sm text-neutral-700">
                        <strong>Reason:</strong> {r.reason}
                      </p>
                    ))}
                  {gradingResult.results.some((r) => r.isHidden) && (
                    <p className="text-sm text-neutral-500">
                      Plus {gradingResult.results.filter((r) => r.isHidden).length} hidden test case(s).
                    </p>
                  )}
                </div>
              ) : queryError ? (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{queryError}</AlertDescription>
                </Alert>
              ) : queryResult ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                    <span>
                      {queryResult.rowCount} row{queryResult.rowCount !== 1 ? "s" : ""}
                    </span>
                    <span>{queryResult.executionTime}ms</span>
                  </div>
                  <div className="max-h-[260px] overflow-auto rounded-md border border-neutral-200">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-neutral-50">
                        <TableRow>
                          {queryResult.columns.map((column, index) => (
                            <TableHead key={index}>{column}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResult.rows.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {queryResult.columns.map((column, colIndex) => (
                              <TableCell key={colIndex} className="font-mono">
                                {row[column] !== null && row[column] !== undefined
                                  ? String(row[column])
                                  : "NULL"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
