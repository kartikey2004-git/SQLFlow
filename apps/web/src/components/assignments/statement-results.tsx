"use client";

import { cn } from "@sql-learn/ui/lib/utils";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@sql-learn/ui/components/table";
import type { QueryResult, StatementResult } from "@sql-learn/types";

const formatCell = (value: unknown) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

function StatementPanel({ statement }: { statement: StatementResult }) {
  const failed = Boolean(statement.error);
  return (
    <div className={cn("border", failed ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-inherit px-3 py-2 font-mono text-xs text-neutral-600">
        <span className="text-neutral-400">#{statement.index + 1}</span>
        <span className={cn("font-semibold", failed ? "text-red-700" : "text-emerald-700")}>
          {statement.command || "STATEMENT"}
        </span>
        {statement.rowCount !== null && (
          <span>
            {statement.rowCount} row{statement.rowCount === 1 ? "" : "s"}
          </span>
        )}
        <span>{statement.durationMs} ms</span>
      </div>

      {statement.error ? (
        <div className="flex flex-col gap-1 px-3 py-3 text-sm text-red-800" role="alert">
          <span className="font-medium">{statement.error.message}</span>
          {(statement.error.code || statement.error.position !== undefined) && (
            <span className="font-mono text-xs text-red-600">
              {statement.error.code && <>SQLSTATE {statement.error.code}</>}
              {statement.error.code && statement.error.position !== undefined && " · "}
              {statement.error.position !== undefined && <>position {statement.error.position}</>}
            </span>
          )}
        </div>
      ) : statement.columns.length > 0 ? (
        <div className="flex flex-col">
          <div className="max-h-[260px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-neutral-50">
                <TableRow>
                  {statement.columns.map((column, index) => (
                    <TableHead key={index} className="font-mono text-xs">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {statement.columns.map((column, colIndex) => (
                      <TableCell key={colIndex} className="font-mono text-xs">
                        {formatCell(row[column])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {statement.truncated && (
            <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Results truncated: showing the first {statement.rows.length} row
              {statement.rows.length === 1 ? "" : "s"}.
            </p>
          )}
        </div>
      ) : (
        <p className="px-3 py-3 text-xs text-neutral-500">Completed with no rows returned.</p>
      )}
    </div>
  );
}

export function StatementResults({
  statements,
  aborted,
  executionTime,
}: Pick<QueryResult, "statements" | "aborted"> & { executionTime?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-neutral-500">
        <span>
          {statements.length} statement{statements.length === 1 ? "" : "s"}
        </span>
        {executionTime !== undefined && <span>{executionTime} ms</span>}
      </div>
      {statements.map((statement) => (
        <StatementPanel key={statement.index} statement={statement} />
      ))}
      {aborted && (
        <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="status">
          Execution stopped. Remaining statements were not run.
        </p>
      )}
    </div>
  );
}
