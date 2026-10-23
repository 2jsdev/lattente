const { query, pool } = require("../db");
const { badRequest, notFound } = require("../lib/http");

const ALLOWED_STATUSES = ["pending", "confirmed", "done", "cancelled"];

async function createWithItems({ email, address, quantity, notes, items }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `INSERT INTO orders (email, address, quantity, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at, status`,
      [email, address, quantity, notes || null]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      let productName = item.name;
      let unitPrice = Number(item.price) || 0;

      if (item.productId) {
        const product = await client.query(
          `SELECT name, price FROM products WHERE id = $1`,
          [item.productId]
        );
        if (product.rows[0]) {
          productName = product.rows[0].name;
          unitPrice = Number(product.rows[0].price);
        }
      }

      if (!productName) {
        throw badRequest("Cada ítem necesita nombre o productId");
      }

      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.id,
          item.productId || null,
          productName,
          unitPrice,
          item.quantity || 1,
        ]
      );
    }

    await client.query("COMMIT");
    return order;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listAll() {
  const result = await query(
    `SELECT o.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'product_name', oi.product_name,
                  'unit_price', oi.unit_price,
                  'quantity', oi.quantity
                )
                ORDER BY oi.id
              ) FILTER (WHERE oi.id IS NOT NULL),
              '[]'
            ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 100`
  );
  return result.rows;
}

async function updateStatus(id, status) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw badRequest("Estado inválido");
  }

  const result = await query(
    `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );

  if (!result.rows[0]) {
    throw notFound("Pedido no encontrado");
  }

  return result.rows[0];
}

module.exports = {
  ALLOWED_STATUSES,
  createWithItems,
  listAll,
  updateStatus,
};
