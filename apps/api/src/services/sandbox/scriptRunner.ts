import Cursor from "pg-cursor";
import type pg from "pg";
import { parse } from "pgsql-parser";
import type { QueryResult, StatementResult } from "@sql-learn/types";

export const ROW_CAP = 1000;
export const BYTE_CAP = 1_000_000;
const BATCH = 50;

export async function splitStatements(sql: string): Promise<string[]> {
  try {
    const parsed = (await parse(sql)) as { stmts?: { stmt_location?: number; stmt_len?: number }[] };
    const stmts = parsed.stmts ?? [];
    if (stmts.length === 0) return [];
    const buf = Buffer.from(sql, "utf8");
    return stmts
      .map((s) => {
        const start = s.stmt_location ?? 0;
        const end = s.stmt_len ? start + s.stmt_len : buf.length;
        return buf.subarray(start, end).toString("utf8").trim();
      })
      .filter((text) => text.length > 0);
  } catch {
    return [sql];
  }
}

function readBatch(cursor: Cursor<Record<string, unknown>>, n: number) {
  return new Promise<{ rows: Record<string, unknown>[]; result: CursorResult }>((resolve, reject) => {
    cursor.read(n, (err, rows, result) => {
      if (err) reject(err);
      else resolve({ rows, result: result as unknown as CursorResult });
    });
  });
}
function closeCursor(cursor: Cursor<Record<string, unknown>>) {
  return new Promise<void>((resolve) => cursor.close(() => resolve()));
}

interface CursorResult {
  command: string | null;
  rowCount: number | null;
  fields?: { name: string }[];
}

export class ScriptDeadline {
  timedOut = false;
}

export async function runScript(
  client: pg.Client,
  sql: string,
  deadline: ScriptDeadline = new ScriptDeadline(),
): Promise<QueryResult> {
  const started = Date.now();
  const texts = await splitStatements(sql);
  const statements: StatementResult[] = [];
  let aborted = false;

  for (let i = 0; i < texts.length; i++) {
    const t0 = Date.now();
    const cursor = client.query(new Cursor<Record<string, unknown>>(texts[i]!));
    try {
      const rows: Record<string, unknown>[] = [];
      let truncated = false;
      let bytes = 0;
      let meta: CursorResult = { command: null, rowCount: null };
      for (;;) {
        const batch = await readBatch(cursor, BATCH);
        meta = batch.result;
        for (const row of batch.rows) {
          if (rows.length >= ROW_CAP || bytes >= BYTE_CAP) {
            truncated = true;
            break;
          }
          bytes += Buffer.byteLength(JSON.stringify(row));
          rows.push(row);
        }
        if (truncated || batch.rows.length < BATCH) break;
      }
      if (truncated) await closeCursor(cursor);
      statements.push({
        index: i,
        command: meta.command ?? "",
        rowCount: truncated ? null : (meta.rowCount ?? null),
        columns: meta.fields?.map((f) => f.name) ?? [],
        rows,
        truncated,
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      const e = err as { message?: string; code?: string; position?: string };
      statements.push({
        index: i,
        command: "",
        rowCount: null,
        columns: [],
        rows: [],
        truncated: false,
        durationMs: Date.now() - t0,
        error: {
          message: deadline.timedOut ? "Script exceeded the time limit and was cancelled" : (e.message ?? "Unknown error"),
          code: deadline.timedOut ? "57014" : e.code,
          position: e.position ? Number(e.position) : undefined,
        },
      });
      aborted = true;
      break;
    }
  }

  return { statements, executionTime: Date.now() - started, aborted };
}
