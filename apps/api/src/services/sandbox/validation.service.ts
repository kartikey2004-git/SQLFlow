import { parse } from "pgsql-parser";

/**
 * AST-based SQL validator using libpg_query (the real Postgres grammar, via
 * WASM) instead of the old regex keyword allow/blocklist - a regex can't see
 * through comments, string literals, or nested constructs, so it was
 * trivially bypassable. This is a defense-in-depth layer, not the security
 * boundary itself: the actual boundary is the privilege-revoked
 * `sandbox_runner` role (see migrations/1700000000002_sandbox_runner_role.cjs)
 * and per-transaction statement_timeout. A parser bug or an unlisted
 * dangerous function here must still be caught by the DB-level restrictions.
 */

const DENIED_STATEMENT_TYPES = new Set([
  "InsertStmt",
  "UpdateStmt",
  "DeleteStmt",
  "MergeStmt",
  "CreateStmt",
  "CreateTableAsStmt",
  "DropStmt",
  "AlterTableStmt",
  "TruncateStmt",
  "CopyStmt",
  "GrantStmt",
  "GrantRoleStmt",
  "VacuumStmt",
  "ExecuteStmt",
  "PrepareStmt",
  "DeallocateStmt",
  "DoStmt",
  "CallStmt",
  "VariableSetStmt",
  "TransactionStmt",
  "ListenStmt",
  "NotifyStmt",
  "UnlistenStmt",
  "LockStmt",
  "ReindexStmt",
  "ClusterStmt",
  "CreateExtensionStmt",
  "AlterSystemStmt",
  "CreateFunctionStmt",
  "CreateRoleStmt",
  "AlterRoleStmt",
  "DropRoleStmt",
  "CreatedbStmt",
  "DropdbStmt",
  "RefreshMatViewStmt",
]);

// Functions that read/write the filesystem, open network connections, control
// backends, or stall execution - denied regardless of what the DB role grants,
// as a second layer in front of the (primary) privilege revocation.
const DENIED_FUNCTIONS = new Set([
  "pg_sleep",
  "pg_sleep_for",
  "pg_sleep_until",
  "pg_read_file",
  "pg_read_binary_file",
  "pg_ls_dir",
  "pg_ls_logdir",
  "pg_ls_waldir",
  "pg_ls_tmpdir",
  "pg_stat_file",
  "lo_import",
  "lo_export",
  "lo_read",
  "lo_write",
  "lo_open",
  "lo_creat",
  "lo_create",
  "lo_unlink",
  "lo_get",
  "lo_put",
  "dblink",
  "dblink_connect",
  "dblink_connect_u",
  "dblink_exec",
  "dblink_open",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "pg_reload_conf",
  "pg_rotate_logfile",
  "set_config",
]);

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface WalkContext {
  errors: string[];
}

const funcCallName = (call: { funcname?: unknown[] }): string | null => {
  if (!Array.isArray(call.funcname)) return null;
  const parts = call.funcname
    .map((n) => (n as { String?: { sval?: string } })?.String?.sval)
    .filter((v): v is string => Boolean(v));
  return parts.length > 0 ? parts[parts.length - 1]!.toLowerCase() : null;
};

const walk = (node: unknown, ctx: WalkContext): void => {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, ctx);
    return;
  }
  if (node === null || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const keys = Object.keys(record);

  // AST nodes from this parser are tagged unions: a single-key object whose
  // key is the node type name (e.g. { SelectStmt: {...} }).
  if (keys.length === 1) {
    const tag = keys[0]!;
    const value = record[tag];

    if (DENIED_STATEMENT_TYPES.has(tag)) {
      ctx.errors.push(`Statement type '${tag}' is not allowed - only SELECT is permitted`);
    }

    if (tag === "SelectStmt" && value && typeof value === "object" && "intoClause" in value && (value as { intoClause?: unknown }).intoClause) {
      ctx.errors.push("SELECT INTO is not allowed");
    }

    // `sandbox_runner` is one shared Postgres role across every student
    // (GRANT SELECT is role-wide, not per-session) - `search_path` alone
    // only controls *unqualified* name resolution, so a schema-qualified
    // reference like `sb_u1_a1.widgets` would otherwise read straight
    // through another student's sandbox. Forcing every table reference to
    // be unqualified (resolved only via the pinned search_path) is what
    // actually enforces per-student isolation at this layer.
    if (tag === "RangeVar") {
      const range = value as { schemaname?: string };
      if (range.schemaname) {
        ctx.errors.push("Schema-qualified table references are not allowed");
      }
    }

    if (tag === "FuncCall") {
      const name = funcCallName(value as { funcname?: unknown[] });
      if (name && DENIED_FUNCTIONS.has(name)) {
        ctx.errors.push(`Function '${name}' is not allowed`);
      }
    }

    walk(value, ctx);
    return;
  }

  for (const key of keys) {
    walk(record[key], ctx);
  }
};

export const ValidationService = {
  async validate(query: string): Promise<ValidationResult> {
    if (!query || query.trim().length === 0) {
      return { isValid: false, error: "Query cannot be empty" };
    }

    let parsed;
    try {
      parsed = await parse(query);
    } catch {
      return { isValid: false, error: "SQL syntax error" };
    }

    const stmts = parsed.stmts ?? [];
    if (stmts.length === 0) {
      return { isValid: false, error: "Query cannot be empty" };
    }
    if (stmts.length > 1) {
      return { isValid: false, error: "Multiple SQL statements are not allowed" };
    }

    const topLevel = stmts[0]!.stmt;
    const topKeys = topLevel ? Object.keys(topLevel) : [];
    if (topKeys.length !== 1 || topKeys[0] !== "SelectStmt") {
      return {
        isValid: false,
        error: `Only SELECT statements are allowed${topKeys[0] ? ` (found ${topKeys[0]})` : ""}`,
      };
    }

    const ctx: WalkContext = { errors: [] };
    walk(topLevel, ctx);

    if (ctx.errors.length > 0) {
      return { isValid: false, error: ctx.errors[0] };
    }

    return { isValid: true };
  },
};
