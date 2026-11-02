// Rutas públicas: menú, productos, pedidos y feedback
const express = require('express');
const db = require('../conexion');

const routes = express.Router();

// images se guarda como texto JSON en MySQL -> lo convertimos a lista
function arreglarFotos(producto) {
  let images = [];
  try {
    images = JSON.parse(producto.images || '[]');
  } catch (e) {
    images = [];
  }
  if (images.length === 0 && producto.image_url) images = [producto.image_url];
  return { ...producto, images, image_url: images[0] || null };
}

// VER CATEGORÍAS  (?home=true  ?group=frias)
routes.get('/categories', async (req, res) => {
  try {
    let sql = 'SELECT * FROM categories WHERE 1=1';
    const valores = [];

    if (req.query.home === 'true') {
      sql += ' AND show_on_home = 1';
    }
    if (req.query.group && req.query.group !== 'todos') {
      sql += ' AND menu_group = ?';
      valores.push(req.query.group);
    }
    sql += ' ORDER BY sort_order';

    const [filas] = await db.query(sql, valores);
    res.json(filas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las categorías' });
  }
});

// VER UNA CATEGORÍA CON SUS PRODUCTOS
routes.get('/categories/:slug', async (req, res) => {
  try {
    const [cats] = await db.query('SELECT * FROM categories WHERE slug = ?', [req.params.slug]);
    if (cats.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    const categoria = cats[0];

    const [productos] = await db.query(
      'SELECT * FROM products WHERE category_id = ? AND active = 1 ORDER BY id',
      [categoria.id]
    );
    categoria.products = productos.map(arreglarFotos);
    res.json(categoria);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener la categoría' });
  }
});

// VER PRODUCTOS  (?featured=true  ?category=slug)
routes.get('/products', async (req, res) => {
  try {
    let sql = `SELECT p.*, c.slug AS category_slug, c.name AS category_name
               FROM products p
               JOIN categories c ON c.id = p.category_id
               WHERE p.active = 1`;
    const valores = [];

    if (req.query.featured === 'true') {
      sql += ' AND p.featured = 1';
    }
    if (req.query.category) {
      sql += ' AND c.slug = ?';
      valores.push(req.query.category);
    }
    sql += ' ORDER BY p.id';

    const [filas] = await db.query(sql, valores);
    res.json(filas.map(arreglarFotos));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// CREAR UN PEDIDO (pedido + sus productos, en una transacción)
routes.post('/orders', async (req, res) => {
  const { email, address, quantity, notes, items } = req.body;

  if (!email || !address) {
    return res.status(400).json({ error: 'Debes ingresar email y dirección' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Selecciona al menos un producto' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [resultado] = await conn.query(
      'INSERT INTO orders (email, address, quantity, notes) VALUES (?, ?, ?, ?)',
      [email, address, quantity || 1, notes || null]
    );
    const idPedido = resultado.insertId;

    for (const item of items) {
      let nombre = item.name;
      let precio = Number(item.price) || 0;

      // Si viene el id del producto, usamos el nombre y precio de la base
      if (item.productId) {
        const [prod] = await conn.query('SELECT name, price FROM products WHERE id = ?', [item.productId]);
        if (prod.length > 0) {
          nombre = prod[0].name;
          precio = Number(prod[0].price);
        }
      }

      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
         VALUES (?, ?, ?, ?, ?)`,
        [idPedido, item.productId || null, nombre || 'Producto', precio, item.quantity || 1]
      );
    }

    await conn.commit();
    res.status(201).json({ ok: true, order: { id: idPedido, status: 'pending' } });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el pedido' });
  } finally {
    conn.release();
  }
});

// ENVIAR FEEDBACK
routes.post('/feedback', async (req, res) => {
  const { email, rating, comment } = req.body;
  const nota = Number(rating);

  if (!email || !(nota >= 1 && nota <= 5)) {
    return res.status(400).json({ error: 'Debes ingresar email y una calificación de 1 a 5' });
  }

  try {
    const [resultado] = await db.query(
      'INSERT INTO feedback (email, rating, comment) VALUES (?, ?, ?)',
      [email, nota, comment || null]
    );
    res.status(201).json({ ok: true, feedback: { id: resultado.insertId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el feedback' });
  }
});

// REDES SOCIALES (para el footer)
routes.get('/site-settings/social-links', async (req, res) => {
  try {
    const [filas] = await db.query("SELECT value FROM site_settings WHERE setting_key = 'social_links'");
    const links = filas.length ? JSON.parse(filas[0].value) : {};
    res.json({ instagram: '', facebook: '', tiktok: '', ...links });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las redes sociales' });
  }
});

module.exports = routes;
