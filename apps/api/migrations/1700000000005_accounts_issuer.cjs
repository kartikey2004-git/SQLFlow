/**
 * `@better-auth/cli generate` did not include `issuer` in the Accounts model
 * it produced (see 1700000000003_better_auth.cjs), but the actual runtime
 * write path (internalAdapter.linkAccount, exercised by a real sign-up)
 * does send it on every insert - confirmed empirically via a failing test
 * run ("Unknown argument `issuer`"), not by the CLI output. Runtime
 * behavior wins over the generator here.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("accounts", {
    issuer: { type: "text", notNull: true, default: "" },
  });
  pgm.alterColumn("accounts", "issuer", { default: null });
};

exports.down = (pgm) => {
  pgm.dropColumn("accounts", "issuer");
};
