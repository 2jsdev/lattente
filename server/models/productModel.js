const { query } = require("../db");
const { parseImages, withProductImages } = require("../lib/product-images");
const { badRequest, notFound } = require("../lib/http");
const { parseBool } = require("../lib/parseBool");

function mergeImageList(body = {}, uploadedPaths = []) {
  const fromBody = parseImages(body.images ?? body.image_url, body.image_url);
  return [...new Set([...fromBody, ...uploadedPaths])];
}

function normalizeProductInput(body, uploadedPaths = [], { partial = false } = {}) {
  const {
    category_id,
    name,
    description,
    price,
    currency = "Bs.",
    image_url,
    images,
    featured,
    sort_order = 0,
    active,
  } = body;

  if (!partial) {
    if (!category_id || !name || price == null || price === "") {
      throw badRequest("category_id, name y price son requeridos");
    }
  }

  const hasImages =
    images !== undefined ||
    image_url !== undefined ||
    uploadedPaths.length > 0;

  const parsedImages = hasImages ? mergeImageList(body, uploadedPaths) : null;

  return {
    category_id:
      category_id != null && category_id !== "" ? Number(category_id) : null,
    name: name != null ? String(name).trim() : null,
    description:
      description !== undefined ? String(description).trim() || null : undefined,
    price: price != null && price !== "" ? Number(price) : null,
    currency: currency != null ? String(currency) : null,
    hasImages,
    cover: parsedImages ? parsedImages[0] || null : null,
    imagesJson: parsedImages ? JSON.stringify(parsedImages) : null,
    featured:
      featured !== undefined && featured !== null && featured !== ""
        ? parseBool(featured, false)
        : partial
          ? null
          : false,
    sort_order:
      sort_order != null && sort_order !== "" ? Number(sort_order) : null,
    active:
      active !== undefined && active !== null && active !== ""
        ? parseBool(active, true)
        : partial
          ? null
          : true,
  };
}

async function listActive({ category, featured } = {}) {
  const clauses = ["p.active = TRUE"];
  const params = [];

  if (category) {
    params.push(category);
    clauses.push(`c.slug = $${params.length}`);
  }

  if (featured === "true") {
    clauses.push("p.featured = TRUE");
  }

  const result = await query(
    `SELECT p.id, p.name, p.description, p.price, p.currency,
            p.image_url, p.images, p.featured, p.sort_order,
            c.slug AS category_slug, c.name AS category_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY p.sort_order, p.id`,
    params
  );
  return result.rows.map(withProductImages);
}

async function findById(id) {
  const result = await query(`SELECT name, price FROM products WHERE id = $1`, [
    id,
  ]);
  return result.rows[0] || null;
}

async function listAll() {
  const result = await query(
    `SELECT p.id, p.name, p.description, p.price, p.currency,
            p.image_url, p.images, p.featured, p.sort_order, p.active, p.category_id,
            c.slug AS category_slug, c.name AS category_name
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ORDER BY c.sort_order, p.sort_order, p.id`
  );
  return result.rows.map(withProductImages);
}

async function create(body, uploadedPaths = []) {
  const data = normalizeProductInput(body, uploadedPaths, { partial: false });

  const result = await query(
    `INSERT INTO products
       (category_id, name, description, price, currency, image_url, images, featured, sort_order, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
     RETURNING *`,
    [
      data.category_id,
      data.name,
      data.description ?? null,
      data.price,
      data.currency || "Bs.",
      data.cover,
      data.imagesJson || "[]",
      data.featured ?? false,
      data.sort_order || 0,
      data.active ?? true,
    ]
  );

  return withProductImages(result.rows[0]);
}

async function update(id, body, uploadedPaths = []) {
  const data = normalizeProductInput(body, uploadedPaths, { partial: true });

  const result = await query(
    `UPDATE products SET
       category_id = COALESCE($1, category_id),
       name = COALESCE($2, name),
       description = CASE WHEN $13 THEN $3 ELSE description END,
       price = COALESCE($4, price),
       currency = COALESCE($5, currency),
       image_url = CASE WHEN $11 THEN $6 ELSE image_url END,
       images = CASE WHEN $11 THEN $7::jsonb ELSE images END,
       featured = COALESCE($8, featured),
       sort_order = COALESCE($9, sort_order),
       active = COALESCE($10, active)
     WHERE id = $12
     RETURNING *`,
    [
      data.category_id,
      data.name,
      data.description ?? null,
      data.price,
      data.currency,
      data.cover,
      data.imagesJson,
      data.featured,
      data.sort_order,
      data.active,
      data.hasImages,
      id,
      body.description !== undefined,
    ]
  );

  if (!result.rows[0]) {
    throw notFound("Producto no encontrado");
  }

  return withProductImages(result.rows[0]);
}

async function remove(id) {
  const result = await query(`DELETE FROM products WHERE id = $1 RETURNING id`, [
    id,
  ]);
  if (!result.rows[0]) {
    throw notFound("Producto no encontrado");
  }
  return { ok: true };
}

module.exports = {
  listActive,
  findById,
  listAll,
  create,
  update,
  remove,
};
