const { query } = require("../db");

async function create({ email, rating, comment }) {
  const result = await query(
    `INSERT INTO feedback (email, rating, comment)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [email, rating, comment || null]
  );
  return result.rows[0];
}

async function listAll() {
  const result = await query(
    `SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100`
  );
  return result.rows;
}

module.exports = {
  create,
  listAll,
};
