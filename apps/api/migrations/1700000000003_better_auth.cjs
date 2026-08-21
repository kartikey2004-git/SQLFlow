/**
 * Migrates authentication ownership to Better Auth (packages/auth/src/auth.ts).
 *
 * Column/table shape below matches `npx @better-auth/cli generate` run
 * against the real auth.ts config (not hand-guessed) - see prompt.md's
 * no-hallucination requirement - with `Int` swapped for `bigint`/`bigserial`
 * throughout so the new tables match `users.id`'s existing bigserial type
 * (auth.ts sets `advanced.database.generateId: "serial"`, which is
 * type-agnostic between int/bigint at the Postgres level).
 *
 * The old hand-rolled `sessions` table (sha256-hashed token, soft-revoke via
 * revoked_at) is structurally incompatible with Better Auth's session model
 * (plaintext token lookup, delete-on-revoke) and nothing else FKs into it,
 * so it's dropped and recreated rather than altered.
 *
 * `users.password_hash` is intentionally NOT dropped here - existing hashes
 * are backfilled into `accounts` by scripts/migrateAuthAccounts.ts first;
 * the column is dropped in a later migration once that's verified.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // --- users: new Better Auth core fields ---------------------------------
  pgm.addColumns("users", {
    email_verified: { type: "boolean", notNull: true, default: false },
    image: { type: "text" },
  });

  // --- sessions: drop the old hash-based table, recreate for Better Auth --
  pgm.dropTable("sessions");
  pgm.createTable("sessions", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    token: { type: "text", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    ip: { type: "text" },
    user_agent: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("sessions", "user_id");

  // --- accounts (new) - one row per linked auth method (credential/OAuth) --
  pgm.createTable("accounts", {
    id: { type: "bigserial", primaryKey: true },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    account_id: { type: "text", notNull: true },
    provider_id: { type: "text", notNull: true },
    access_token: { type: "text" },
    refresh_token: { type: "text" },
    id_token: { type: "text" },
    access_token_expires_at: { type: "timestamptz" },
    refresh_token_expires_at: { type: "timestamptz" },
    scope: { type: "text" },
    password: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("accounts", "user_id");

  // --- verifications (new) - short-lived tokens for Better Auth flows -----
  pgm.createTable("verifications", {
    id: { type: "bigserial", primaryKey: true },
    identifier: { type: "text", notNull: true },
    value: { type: "text", notNull: true },
    expires_at: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("verifications", "identifier");
};

exports.down = (pgm) => {
  pgm.dropTable("verifications");
  pgm.dropTable("accounts");
  pgm.dropTable("sessions");
  pgm.createTable("sessions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: { type: "bigint", notNull: true, references: "users", onDelete: "CASCADE" },
    token_hash: { type: "text", notNull: true, unique: true },
    user_agent: { type: "text" },
    ip: { type: "text" },
    expires_at: { type: "timestamptz", notNull: true },
    revoked_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("sessions", "user_id");
  pgm.createIndex("sessions", "expires_at", { where: "revoked_at IS NULL" });
  pgm.dropColumns("users", ["email_verified", "image"]);
};
