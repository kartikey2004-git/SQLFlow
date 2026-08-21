-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "assignments" (
    "id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "question" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "sample_tables" JSONB NOT NULL DEFAULT '[]',
    "solution_sql" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "search_vector" tsvector DEFAULT to_tsvector('english'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text))),

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "assignment_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "last_query" TEXT NOT NULL DEFAULT '',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),
    "schema_name" TEXT,
    "schema_provisioned_at" TIMESTAMPTZ(6),
    "last_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_results" (
    "id" BIGSERIAL NOT NULL,
    "submission_id" BIGINT NOT NULL,
    "test_case_id" BIGINT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hint_requests" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "assignment_id" BIGINT NOT NULL,
    "attempt_id" BIGINT,
    "user_query" TEXT NOT NULL,
    "hint_level" INTEGER NOT NULL,
    "concept_tag" TEXT,
    "hint_text" TEXT NOT NULL,
    "model" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "leak_check_passed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hint_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_executions" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempt_id" BIGINT NOT NULL,
    "sql_text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "row_count" INTEGER,
    "duration_ms" INTEGER,

    CONSTRAINT "query_executions_pkey" PRIMARY KEY ("id","created_at")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" BIGINT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" BIGSERIAL NOT NULL,
    "attempt_id" BIGINT NOT NULL,
    "sql_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "passed" BOOLEAN,
    "score" DECIMAL(5,2),
    "execution_time_ms" INTEGER,
    "row_count" INTEGER,
    "error_message" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" BIGSERIAL NOT NULL,
    "assignment_id" BIGINT NOT NULL,
    "name" TEXT,
    "expected_output_type" TEXT NOT NULL,
    "expected_output" JSONB NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignments_public_id_key" ON "assignments"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_slug_unique_idx" ON "assignments"("slug") WHERE ((deleted_at IS NULL) AND (slug IS NOT NULL));

-- CreateIndex
CREATE INDEX "assignments_search_vector_index" ON "assignments" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_schema_name_key" ON "attempts"("schema_name");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_user_assignment_unique" ON "attempts"("user_id", "assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_results_submission_test_case_unique" ON "evaluation_results"("submission_id", "test_case_id");

-- CreateIndex
CREATE INDEX "hint_requests_user_id_assignment_id_created_at_index" ON "hint_requests"("user_id", "assignment_id", "created_at");

-- CreateIndex
CREATE INDEX "query_executions_attempt_id_created_at_index" ON "query_executions"("attempt_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_expires_at_index" ON "sessions"("expires_at") WHERE (revoked_at IS NULL);

-- CreateIndex
CREATE INDEX "sessions_user_id_index" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "submissions_attempt_id_index" ON "submissions"("attempt_id");

-- CreateIndex
CREATE INDEX "submissions_status_index" ON "submissions"("status") WHERE (status = ANY (ARRAY['pending'::text, 'evaluating'::text]));

-- CreateIndex
CREATE INDEX "test_cases_assignment_id_order_index_index" ON "test_cases"("assignment_id", "order_index");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hint_requests" ADD CONSTRAINT "hint_requests_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hint_requests" ADD CONSTRAINT "hint_requests_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hint_requests" ADD CONSTRAINT "hint_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "query_executions" ADD CONSTRAINT "query_executions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- Manually appended: DDL that Prisma's schema language cannot represent
-- (CHECK constraints, the generated tsvector column + trigger function, and
-- an expression unique index), copied verbatim from
-- apps/api/migrations/1700000000001_schema.cjs so a local `prisma migrate
-- reset` reconstructs the schema faithfully. The live Neon database already
-- has all of this (created by node-pg-migrate before this baseline was
-- recorded) - this addendum affects future local resets only, not Neon.

-- CheckConstraint (users.role)
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK (role IN ('student', 'instructor', 'admin'));

-- CheckConstraint (assignments.difficulty)
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_difficulty_check" CHECK (difficulty IN ('easy', 'medium', 'hard'));

-- CheckConstraint (test_cases.expected_output_type)
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_expected_output_type_check" CHECK (expected_output_type IN ('table', 'single_value', 'column', 'row', 'count'));

-- CheckConstraint (test_cases.weight)
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_weight_check" CHECK (weight >= 0);

-- CheckConstraint (attempts.status)
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_status_check" CHECK (status IN ('in_progress', 'completed'));

-- CheckConstraint (query_executions.status)
ALTER TABLE "query_executions" ADD CONSTRAINT "query_executions_status_check" CHECK (status IN ('success', 'error', 'timeout'));

-- CheckConstraint (submissions.status)
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_status_check" CHECK (status IN ('pending', 'evaluating', 'completed', 'failed'));

-- ExpressionIndex (not representable in schema.prisma - see users.email doc comment)
CREATE UNIQUE INDEX users_email_lower_unique_idx ON users (lower(email)) WHERE deleted_at IS NULL;

-- GeneratedColumn (search_vector is created via db pull's Unsupported() field
-- already, so the column itself exists from the CreateTable statement above
-- with its DEFAULT - but Prisma's diff emits it as a plain DEFAULT, not
-- GENERATED ALWAYS ... STORED. Re-declare it correctly for a from-scratch
-- reset. Safe to run even though the earlier CreateTable already added a
-- same-named column with a plain default: drop and recreate as generated.)
ALTER TABLE "assignments" DROP COLUMN "search_vector";
ALTER TABLE assignments ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

-- Trigger function + triggers (updated_at maintenance)
CREATE OR REPLACE FUNCTION "set_updated_at"()
  RETURNS trigger
  AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$
  VOLATILE
  LANGUAGE plpgsql;

CREATE TRIGGER "users_set_updated_at"
  BEFORE UPDATE ON "users"
  FOR EACH ROW
  EXECUTE PROCEDURE "set_updated_at"();

CREATE TRIGGER "assignments_set_updated_at"
  BEFORE UPDATE ON "assignments"
  FOR EACH ROW
  EXECUTE PROCEDURE "set_updated_at"();

CREATE TRIGGER "test_cases_set_updated_at"
  BEFORE UPDATE ON "test_cases"
  FOR EACH ROW
  EXECUTE PROCEDURE "set_updated_at"();

CREATE TRIGGER "attempts_set_updated_at"
  BEFORE UPDATE ON "attempts"
  FOR EACH ROW
  EXECUTE PROCEDURE "set_updated_at"();
