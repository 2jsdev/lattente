const { query } = require("../db");
const { badRequest, conflict, notFound } = require("../lib/http");
const { slugify } = require("../lib/slugify");
const { parseBool } = require("../lib/parseBool");
const { withProductImages } = require("../lib/product-images");

function resolveImageUrl(body = {}, uploadedPath = null) {
  if (uploadedPath) return uploadedPath;
  if (body.image_url !== undefined) {
    const value = String(body.image_url || "").trim();
    return value || null;
  }
  return undefined;
}

async function listPublic({ group, home } = {}) {
  const clauses = [];
  const params = [];

  if (home === "true") {
    clauses.push("show_on_home = TRUE");
  }

  if (group && group !== "todos") {
    params.push(group);
    clauses.push(`menu_group = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await query(
    `SELECT id, slug, name, sort_order, image_url, menu_group, show_on_home
     FROM categories
     ${where}
     ORDER BY sort_order`,
    params
  );
  return result.rows;
}

async function findBySlugWithProducts(slug) {
  const cat = await query(
    `SELECT id, slug, name, image_url, menu_group, show_on_home
     FROM categories WHERE slug = $1`,
    [slug]
  );

  if (!cat.rows[0]) {
    return null;
  }

  const products = await query(
    `SELECT id, name, description, price, currency, image_url, images, sort_order
     FROM products
     WHERE category_id = $1 AND active = TRUE
     ORDER BY sort_order, id`,
    [cat.rows[0].id]
  );

  return {
    ...cat.rows[0],
    products: products.rows.map(withProductImages),
  };
}

async function listAll() {
  const result = await query(
    `SELECT c.*, COUNT(p.id)::int AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id
     ORDER BY c.sort_order, c.id`
  );
  return result.rows;
}

async function create(body, uploadedPath = null) {
  const {
    name,
    slug,
    menu_group = "comida",
    show_on_home = true,
    sort_order = 0,
  } = body;

  if (!name) {
    throw badRequest("name es requerido");
  }

  const imageUrl = resolveImageUrl(body, uploadedPath) ?? null;

  try {
    const result = await query(
      `INSERT INTO categories (slug, name, image_url, menu_group, show_on_home, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        slugify(slug || name),
        String(name).trim(),
        imageUrl,
        menu_group,
        parseBool(show_on_home, true),
        Number(sort_order) || 0,
      ]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === "23505") {
      throw conflict("Ese slug ya existe");
    }
    throw err;
  }
}

async function update(id, body, uploadedPath = null) {
  const { name, slug, menu_group, show_on_home, sort_order } = body;
  const imageUrl = resolveImageUrl(body, uploadedPath);
  const hasImage = imageUrl !== undefined;

  try {
    const result = await query(
      `UPDATE categories SET
         name = COALESCE($1, name),
         slug = COALESCE($2, slug),
         image_url = CASE WHEN $8 THEN $3 ELSE image_url END,
         menu_group = COALESCE($4, menu_group),
         show_on_home = COALESCE($5, show_on_home),
         sort_order = COALESCE($6, sort_order)
       WHERE id = $7
       RETURNING *`,
      [
        name != null && name !== "" ? String(name).trim() : null,
        slug != null && slug !== "" ? slugify(slug) : null,
        hasImage ? imageUrl : null,
        menu_group ?? null,
        show_on_home !== undefined && show_on_home !== ""
          ? parseBool(show_on_home, true)
          : null,
        sort_order != null && sort_order !== "" ? Number(sort_order) : null,
        id,
        hasImage,
      ]
    );

    if (!result.rows[0]) {
      throw notFound("Categoría no encontrada");
    }

    return result.rows[0];
  } catch (err) {
    if (err.code === "23505") {
      throw conflict("Ese slug ya existe");
    }
    throw err;
  }
}

async function remove(id) {
  const result = await query(
    `DELETE FROM categories WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!result.rows[0]) {
    throw notFound("Categoría no encontrada");
  }
  return { ok: true };
}

module.exports = {
  listPublic,
  findBySlugWithProducts,
  listAll,
  create,
  update,
  remove,
};
