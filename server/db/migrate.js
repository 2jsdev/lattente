require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { pool } = require("./index");
const { sqlDir } = require("../config/paths");
const { logger } = require("../lib/logger");

const MAX_ATTEMPTS = Number(process.env.DB_WAIT_ATTEMPTS || 30);
const RETRY_DELAY_MS = Number(process.env.DB_WAIT_DELAY_MS || 2000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// CapRover starts the app and the database as separate services, so on a
// cold start Postgres is frequently not accepting connections yet. Without
// this retry the container would crash-loop before the DB is ready.
async function waitForDatabase() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      logger.info({ attempt }, "Base de datos conectada");
      return;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        logger.error(
          { err, attempt },
          "No se pudo conectar a la base de datos"
        );
        throw err;
      }
      logger.warn(
        { attempt, max: MAX_ATTEMPTS },
        "Base de datos no disponible; reintentando"
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
}

async function tableExists(table) {
  const { rows } = await pool.query(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`public.${table}`]
  );
  return Boolean(rows[0]?.exists);
}

async function isCatalogEmpty() {
  const exists = await tableExists("categories");
  if (!exists) return true;

  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM categories"
  );
  return rows[0].count === 0;
}

async function run() {
  await waitForDatabase();

  // The schema is idempotent: every statement is CREATE TABLE IF NOT EXISTS,
  // so applying it on every boot is safe and picks up tables added by a
  // newer release without wiping existing data.
  const schema = fs.readFileSync(path.join(sqlDir, "schema.sql"), "utf8");
  await pool.query(schema);
  logger.info("Esquema verificado");

  // The seed is NOT idempotent (categories.slug is UNIQUE) and must never
  // run against a database that already has a catalog — that would abort the
  // migration and, in the local reset flow, wipe real data. Only seed an
  // empty database.
  const empty = await isCatalogEmpty();
  if (empty) {
    const seed = fs.readFileSync(path.join(sqlDir, "seed.sql"), "utf8");
    await pool.query(seed);
    logger.info("Catálogo inicial cargado (base de datos vacía)");
  } else {
    logger.info("Catálogo existente preservado; no se ejecuta el seed");
  }

  // Correct two products that were initially loaded in the coffee category.
  // This targeted update is safe to run on every startup and also repairs
  // existing installations without reseeding or changing other catalog data.
  const categoryCorrections = await pool.query(`
    UPDATE products AS product
    SET category_id = target.id
    FROM categories AS target, categories AS source
    WHERE (
      (product.name = 'RED VELVET CUPCAKES' AND target.slug = 'postres')
      OR (product.name = 'KOREAN SALT BREAD' AND target.slug = 'bolleria')
    )
      AND product.category_id = source.id
      AND source.slug = 'cafes-calientes'
      AND product.category_id <> target.id
  `);
  if (categoryCorrections.rowCount) {
    logger.info({ count: categoryCorrections.rowCount }, "Categorías del catálogo corregidas");
  }

  await pool.end();
}

run().catch((err) => {
  logger.error({ err }, "Error en la migración");
  process.exit(1);
});
