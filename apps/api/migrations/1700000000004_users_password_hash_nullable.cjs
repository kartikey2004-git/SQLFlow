/**
 * Better Auth creates users without ever populating `users.password_hash`
 * (email/password credentials live in `accounts.password` instead - see
 * 1700000000003_better_auth.cjs) - the column must stop being NOT NULL or
 * every sign-up fails. Column itself stays for now: existing hashes are
 * migrated into `accounts` by scripts/migrateAuthAccounts.ts, and this
 * column is dropped in a later migration once that's verified in every
 * environment.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.alterColumn("users", "password_hash", { notNull: false });
};

exports.down = (pgm) => {
  pgm.alterColumn("users", "password_hash", { notNull: true });
};
