const { query } = require("../db");

async function ping() {
  await query("SELECT 1");
  return { ok: true };
}

module.exports = { ping };
