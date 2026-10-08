exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns("users", {
    email_verified: { type: "boolean", notNull: true, default: false },
    image: { type: "text" },
  });

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
