require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pool } = require("./index");
const { sqlDir } = require("../config/paths");
const { logger } = require("../lib/logger");

// Local reset: drops every table, recreates the schema, reloads the catalog.
//
// This is the DESTRUCTIVE path and it is for local development only. The
// production migration (`npm run db:migrate`) never drops anything — it only
// applies the idempotent schema and seeds when the catalog is empty.
async function run() {
  const reset = fs.readFileSync(path.join(sqlDir, "reset.sql"), "utf8");
  const schema = fs.readFileSync(path.join(sqlDir, "schema.sql"), "utf8");
  const seed = fs.readFileSync(path.join(sqlDir, "seed.sql"), "utf8");

  await pool.query(reset);
  await pool.query(schema);
  await pool.query(seed);

  logger.info("Base de datos reiniciada con schema y seed.");
  await pool.end();
}

run().catch((err) => {
  logger.error({ err }, "Error al inicializar la base de datos");
  process.exit(1);
});
