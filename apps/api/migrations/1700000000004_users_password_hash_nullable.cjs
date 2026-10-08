exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.alterColumn("users", "password_hash", { notNull: false });
};

exports.down = (pgm) => {
  pgm.alterColumn("users", "password_hash", { notNull: true });
};
