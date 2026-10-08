exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("submissions", {
    job_id: { type: "uuid" },
  });
  pgm.createIndex("submissions", "job_id", {
    name: "submissions_job_id_unique_idx",
    unique: true,
    where: "job_id IS NOT NULL",
  });

  pgm.addColumn("query_executions", {
    job_id: { type: "uuid" },
  });
  pgm.createIndex("query_executions", "job_id", {
    name: "query_executions_job_id_unique_idx",
    unique: true,
    where: "job_id IS NOT NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("query_executions", "job_id", { name: "query_executions_job_id_unique_idx" });
  pgm.dropColumn("query_executions", "job_id");
  pgm.dropIndex("submissions", "job_id", { name: "submissions_job_id_unique_idx" });
  pgm.dropColumn("submissions", "job_id");
};
