/**
 * Dedicated low-privilege role used to execute student-submitted SQL.
 *
 * This role is intentionally granted nothing beyond CONNECT at creation
 * time — per-sandbox-schema SELECT grants are applied at schema
 * provisioning time (see SandboxService.createSchema), because sandbox
 * schemas don't exist yet when this migration runs. Read-only mode is
 * set at the ROLE level (not via a runtime `SET`) so it survives
 * transaction-mode connection pooling if one is added later.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  const password = process.env.SANDBOX_DB_PASSWORD;
  if (!password) {
    throw new Error(
      "SANDBOX_DB_PASSWORD must be set before running this migration " +
        "(it becomes the login password for the low-privilege sandbox_runner role).",
    );
  }

  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_runner') THEN
        CREATE ROLE sandbox_runner WITH LOGIN PASSWORD '${password.replace(/'/g, "''")}';
      END IF;
    END
    $$;
  `);

  pgm.sql(`ALTER ROLE sandbox_runner SET default_transaction_read_only = on;`);
  pgm.sql(`ALTER ROLE sandbox_runner SET statement_timeout = '3s';`);
  pgm.sql(`ALTER ROLE sandbox_runner SET idle_in_transaction_session_timeout = '5s';`);
  pgm.sql(`ALTER ROLE sandbox_runner SET lock_timeout = '2s';`);
  pgm.sql(`ALTER ROLE sandbox_runner SET work_mem = '8MB';`);
  // temp_file_limit intentionally omitted: it's a superuser-only GUC on
  // managed Postgres platforms (e.g. Neon, where not even the database
  // owner role has superuser) - ALTER ROLE ... SET temp_file_limit fails
  // with "permission denied to set parameter" there. The remaining
  // role-level guards (statement_timeout, idle_in_transaction_session_timeout,
  // lock_timeout, work_mem, default_transaction_read_only) still apply
  // everywhere; a runaway query's temp-file usage is now bounded by the
  // host/compute's own disk limits rather than an explicit per-role cap.

  // No CREATE/superuser/replication rights, no extensions granted.
  // Explicitly never install dblink/postgres_fdw in this database -
  // enforced by their absence here and asserted by the adversarial test suite.
  pgm.sql(`
    DO $$
    BEGIN
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO sandbox_runner', current_database());
    END
    $$;
  `);
  pgm.sql(`REVOKE CREATE ON SCHEMA public FROM PUBLIC;`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP OWNED BY sandbox_runner;`);
  pgm.sql(`DROP ROLE IF EXISTS sandbox_runner;`);
};
