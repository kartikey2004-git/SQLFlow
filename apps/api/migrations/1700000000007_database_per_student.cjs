exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("attempts", {
    sandbox_db: { type: "text", unique: true },
    sandbox_provisioned_at: { type: "timestamptz" },
  });

  pgm.dropConstraint("submissions", "submissions_status_check");
  pgm.addConstraint("submissions", "submissions_status_check", {
    check: "status IN ('pending', 'evaluating', 'completed', 'failed', 'cancelled')",
  });

  pgm.addColumn("test_cases", { validation_sql: { type: "text" } });

  pgm.sql(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN SELECT rolname FROM pg_roles WHERE rolname = 'sandbox_runner' OR left(rolname, 13) = 'sandbox_user_' LOOP
        BEGIN
          EXECUTE format('DROP OWNED BY %I', r.rolname);
          EXECUTE format('DROP ROLE %I', r.rolname);
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'could not drop legacy role %: %', r.rolname, SQLERRM;
        END;
      END LOOP;
    END
    $$;
  `);
};

exports.down = (pgm) => {
  pgm.dropColumn("test_cases", "validation_sql");
  pgm.dropConstraint("submissions", "submissions_status_check");
  pgm.addConstraint("submissions", "submissions_status_check", {
    check: "status IN ('pending', 'evaluating', 'completed', 'failed')",
  });
  pgm.dropColumn("attempts", ["sandbox_db", "sandbox_provisioned_at"]);
};
