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
