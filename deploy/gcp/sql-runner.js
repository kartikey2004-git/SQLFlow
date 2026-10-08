const { Client } = require("pg");

const fail = (e) => {
  console.error("sql-runner failed:", e && e.message ? e.message : e);
  process.exit(1);
};

(async () => {
  const mode = process.env.MODE;
  if (mode === "create-db") {
    const name = process.env.TARGET_DB || "";
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error("invalid TARGET_DB");
    const url = new URL(process.env.DB_URL);
    url.pathname = "/postgres";
    const c = new Client({ connectionString: url.toString() });
    await c.connect();
    const r = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (r.rowCount === 0) {
      await c.query(`CREATE DATABASE "${name}"`);
      console.log(`created database ${name}`);
    } else {
      console.log(`database ${name} already exists`);
    }
    await c.end();
  } else if (mode === "sql") {
    const sql = Buffer.from(process.env.SQL_B64 || "", "base64").toString("utf8");
    if (!sql.trim()) throw new Error("empty SQL_B64");
    const c = new Client({ connectionString: process.env.DB_URL });
    c.on("notice", (n) => console.log("NOTICE:", n.message));
    await c.connect();
    const res = await c.query(sql);
    const results = Array.isArray(res) ? res : [res];
    for (const x of results) {
      if (x.rows && x.rows.length) console.log(JSON.stringify(x.rows));
    }
    await c.end();
    console.log("sql ok");
  } else {
    throw new Error("MODE must be create-db or sql");
  }
})().catch(fail);
