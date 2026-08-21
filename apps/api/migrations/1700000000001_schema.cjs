/**
 * Core relational schema. Consolidates what used to live in MongoDB
 * (assignments, progress, execution/hint logs) into Postgres alongside
 * the sandbox schemas this database already hosts.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // --- users -------------------------------------------------------------
  pgm.createTable("users", {
    id: { type: "bigserial", primaryKey: true },
    email: { type: "text", notNull: true },
    password_hash: { type: "text", notNull: true },
    display_name: { type: "text", notNull: true },
    role: {
      type: "text",
      notNull: true,
      default: "student",
      check: "role IN ('student', 'instructor', 'admin')",
    },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    deleted_at: { type: "timestamptz" },
  });
  pgm.sql(`
    CREATE UNIQUE INDEX users_email_lower_unique_idx ON users (lower(email))
    WHERE deleted_at IS NULL;
  `);

  // --- sessions ------------------------------------------------------------
  pgm.createTable("sessions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "bigint",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    token_hash: { type: "text", notNull: true, unique: true },
    user_agent: { type: "text" },
    ip: { type: "text" },
    expires_at: { type: "timestamptz", notNull: true },
    revoked_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("sessions", "user_id");
  pgm.createIndex("sessions", "expires_at", { where: "revoked_at IS NULL" });

  // --- assignments -----------------------------------------------------
  pgm.createTable("assignments", {
    id: { type: "bigserial", primaryKey: true },
    public_id: { type: "uuid", notNull: true, unique: true, default: pgm.func("gen_random_uuid()") },
    slug: { type: "text" },
    title: { type: "text", notNull: true },
    description: { type: "text" },
    question: { type: "text", notNull: true },
    difficulty: {
      type: "text",
      notNull: true,
      default: "medium",
      check: "difficulty IN ('easy', 'medium', 'hard')",
    },
    // Table/column defs + seed rows used to provision each sandbox schema.
    sample_tables: { type: "jsonb", notNull: true, default: "[]" },
    // Reference solution kept server-side only, for hint leak-detection.
    // Never selected on any student-facing read path.
    solution_sql: { type: "text" },
    is_published: { type: "boolean", notNull: true, default: true },
    created_by: { type: "bigint", references: "users", onDelete: "SET NULL" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    deleted_at: { type: "timestamptz" },
  });
  pgm.createIndex("assignments", "slug", {
    name: "assignments_slug_unique_idx",
    unique: true,
    where: "deleted_at IS NULL AND slug IS NOT NULL",
  });
  pgm.sql(`
    ALTER TABLE assignments ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
    ) STORED;
  `);
  pgm.createIndex("assignments", "search_vector", { method: "gin" });

  // --- test_cases ----------------------------------------------------------
  pgm.createTable("test_cases", {
    id: { type: "bigserial", primaryKey: true },
    assignment_id: {
      type: "bigint",
      notNull: true,
      references: "assignments",
      onDelete: "CASCADE",
    },
    name: { type: "text" },
    expected_output_type: {
      type: "text",
      notNull: true,
      check: "expected_output_type IN ('table', 'single_value', 'column', 'row', 'count')",
    },
    expected_output: { type: "jsonb", notNull: true },
    is_hidden: { type: "boolean", notNull: true, default: false },
    weight: { type: "numeric(5,2)", notNull: true, default: 1, check: "weight >= 0" },
    order_index: { type: "integer", notNull: true, default: 0 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("test_cases", ["assignment_id", "order_index"]);

  // --- attempts (one rolling row per user+assignment; replaces UserProgress) --
  pgm.createTable("attempts", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    assignment_id: {
      type: "bigint",
      notNull: true,
      references: "assignments",
      onDelete: "CASCADE",
    },
    status: {
      type: "text",
      notNull: true,
      default: "in_progress",
      check: "status IN ('in_progress', 'completed')",
    },
    last_query: { type: "text", notNull: true, default: "" },
    attempt_count: { type: "integer", notNull: true, default: 0 },
    completed_at: { type: "timestamptz" },
    // Sandbox schema this attempt provisions into (schema-per user+assignment).
    // Nullable until the sandbox is first initialized.
    schema_name: { type: "text", unique: true },
    schema_provisioned_at: { type: "timestamptz" },
    last_attempt_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("attempts", "attempts_user_assignment_unique", {
    unique: ["user_id", "assignment_id"],
  });

  // --- query_executions (append-only log; composite PK is partition-ready) --
  pgm.createTable(
    "query_executions",
    {
      id: { type: "bigserial", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
      attempt_id: {
        type: "bigint",
        notNull: true,
        references: "attempts",
        onDelete: "CASCADE",
      },
      sql_text: { type: "text", notNull: true },
      status: {
        type: "text",
        notNull: true,
        check: "status IN ('success', 'error', 'timeout')",
      },
      error_message: { type: "text" },
      row_count: { type: "integer" },
      duration_ms: { type: "integer" },
    },
    { constraints: { primaryKey: ["id", "created_at"] } },
  );
  pgm.createIndex("query_executions", ["attempt_id", "created_at"]);

  // --- submissions (a graded "Run & Submit") --------------------------------
  pgm.createTable("submissions", {
    id: { type: "bigserial", primaryKey: true },
    attempt_id: {
      type: "bigint",
      notNull: true,
      references: "attempts",
      onDelete: "CASCADE",
    },
    sql_text: { type: "text", notNull: true },
    status: {
      type: "text",
      notNull: true,
      default: "pending",
      check: "status IN ('pending', 'evaluating', 'completed', 'failed')",
    },
    passed: { type: "boolean" },
    score: { type: "numeric(5,2)" },
    execution_time_ms: { type: "integer" },
    row_count: { type: "integer" },
    error_message: { type: "text" },
    submitted_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("submissions", "status", {
    where: "status IN ('pending', 'evaluating')",
  });
  pgm.createIndex("submissions", "attempt_id");

  // --- evaluation_results ----------------------------------------------------
  pgm.createTable("evaluation_results", {
    id: { type: "bigserial", primaryKey: true },
    submission_id: {
      type: "bigint",
      notNull: true,
      references: "submissions",
      onDelete: "CASCADE",
    },
    test_case_id: {
      type: "bigint",
      notNull: true,
      references: "test_cases",
      onDelete: "CASCADE",
    },
    passed: { type: "boolean", notNull: true },
    details: { type: "jsonb" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("evaluation_results", "evaluation_results_submission_test_case_unique", {
    unique: ["submission_id", "test_case_id"],
  });

  // --- hint_requests (AI hint interaction log; replaces HintLog) -------------
  pgm.createTable("hint_requests", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    assignment_id: {
      type: "bigint",
      notNull: true,
      references: "assignments",
      onDelete: "CASCADE",
    },
    attempt_id: { type: "bigint", references: "attempts", onDelete: "SET NULL" },
    user_query: { type: "text", notNull: true },
    hint_level: { type: "integer", notNull: true },
    concept_tag: { type: "text" },
    hint_text: { type: "text", notNull: true },
    model: { type: "text" },
    input_tokens: { type: "integer" },
    output_tokens: { type: "integer" },
    leak_check_passed: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("hint_requests", ["user_id", "assignment_id", "created_at"]);

  // --- updated_at trigger (Postgres' own `emp_stamp` pattern) -----------------
  pgm.createFunction(
    "set_updated_at",
    [],
    { returns: "trigger", language: "plpgsql", replace: true },
    `
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    `,
  );

  for (const table of ["users", "assignments", "test_cases", "attempts"]) {
    pgm.createTrigger(table, `${table}_set_updated_at`, {
      when: "BEFORE",
      operation: "UPDATE",
      function: "set_updated_at",
      level: "ROW",
    });
  }
};

exports.down = (pgm) => {
  pgm.dropTable("hint_requests");
  pgm.dropTable("evaluation_results");
  pgm.dropTable("submissions");
  pgm.dropTable("query_executions");
  pgm.dropTable("attempts");
  pgm.dropTable("test_cases");
  pgm.dropTable("assignments");
  pgm.dropTable("sessions");
  pgm.dropTable("users");
  pgm.dropFunction("set_updated_at", []);
};
