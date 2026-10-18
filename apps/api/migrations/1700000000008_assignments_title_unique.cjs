exports.shorthands = undefined;

// The seed script upserts assignments by title (ON CONFLICT (title) WHERE deleted_at IS NULL),
// which requires this partial unique index.
exports.up = (pgm) => {
  pgm.createIndex("assignments", "title", {
    name: "assignments_title_active_unique_idx",
    unique: true,
    where: "deleted_at IS NULL",
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("assignments", "title", {
    name: "assignments_title_active_unique_idx",
    ifExists: true,
  });
};
