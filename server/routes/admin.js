// Rutas del panel de administración (/api/admin/...)
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const db = require('../conexion');

const routes = express.Router();

// ---------- CONTRASEÑA DEL ADMIN ----------
const ADMIN_PASSWORD = 'lattente-admin';

// Tokens de las sesiones abiertas (se borran al reiniciar el servidor)
const sesiones = new Set();

// ---------- SUBIDA DE FOTOS (multer) ----------
const almacen = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + extension);
  },
});
const subir = multer({
  storage: almacen,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

// ---------- AYUDANTES ----------
function siNo(valor) {
  return valor === true || valor === 'true' || valor === 'on' || valor === '1' ? 1 : 0;
}

function crearSlug(texto) {
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Lista de fotos = las URLs escritas en el formulario + las fotos subidas
function listaDeFotos(body, archivos) {
  const escritas = String(body.images || body.image_url || '')
    .split('\n')
    .map((url) => url.trim())
    .filter(Boolean);
  const subidas = (archivos || []).map((f) => '/uploads/' + f.filename);
  return [...new Set([...escritas, ...subidas])];
}

function leerFotos(producto) {
  let images = [];
  try { images = JSON.parse(producto.images || '[]'); } catch (e) { images = []; }
  if (images.length === 0 && producto.image_url) images = [producto.image_url];
  return { ...producto, images };
}

// ---------- LOGIN ----------
routes.post('/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.add(token);
  res.json({ ok: true, token });
});

// Todo lo que está debajo necesita haber iniciado sesión
routes.use((req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!sesiones.has(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
});

routes.get('/me', (req, res) => res.json({ ok: true, role: 'admin' }));

// ================= PRODUCTOS =================
routes.get('/products', async (req, res) => {
  try {
    const [filas] = await db.query(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ORDER BY c.sort_order, p.id`
    );
    res.json(filas.map(leerFotos));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

routes.post('/products', subir.array('photos', 8), async (req, res) => {
  const { category_id, name, description, price, currency } = req.body;
  if (!category_id || !name || price === undefined || price === '') {
    return res.status(400).json({ error: 'Categoría, nombre y precio son obligatorios' });
  }
  const fotos = listaDeFotos(req.body, req.files);

  try {
    const [resultado] = await db.query(
      `INSERT INTO products (category_id, name, description, price, currency, image_url, images, featured, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id, name.trim(), description || null, price, currency || 'Bs.',
       fotos[0] || null, JSON.stringify(fotos), siNo(req.body.featured), siNo(req.body.active)]
    );
    res.status(201).json({ ok: true, id: resultado.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
});

routes.put('/products/:id', subir.array('photos', 8), async (req, res) => {
  const { category_id, name, description, price, currency } = req.body;
  const fotos = listaDeFotos(req.body, req.files);

  try {
    const [resultado] = await db.query(
      `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, currency = ?,
         image_url = ?, images = ?, featured = ?, active = ?
       WHERE id = ?`,
      [category_id, name.trim(), description || null, price, currency || 'Bs.',
       fotos[0] || null, JSON.stringify(fotos), siNo(req.body.featured), siNo(req.body.active),
       req.params.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al modificar el producto' });
  }
});

routes.delete('/products/:id', async (req, res) => {
  try {
    const [resultado] = await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al borrar el producto' });
  }
});

// ================= CATEGORÍAS =================
routes.get('/categories', async (req, res) => {
  try {
    const [filas] = await db.query(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order, c.id`
    );
    res.json(filas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener las categorías' });
  }
});

routes.post('/categories', subir.single('photo'), async (req, res) => {
  const { name, slug, menu_group, sort_order } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  const imagen = req.file ? '/uploads/' + req.file.filename : (req.body.image_url || null);

  try {
    const [resultado] = await db.query(
      `INSERT INTO categories (slug, name, image_url, menu_group, show_on_home, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crearSlug(slug || name), name.trim(), imagen, menu_group || 'comida',
       siNo(req.body.show_on_home), Number(sort_order) || 0]
    );
    res.status(201).json({ ok: true, id: resultado.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese slug' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

routes.put('/categories/:id', subir.single('photo'), async (req, res) => {
  const { name, slug, menu_group, sort_order } = req.body;
  const imagen = req.file ? '/uploads/' + req.file.filename : (req.body.image_url || null);

  try {
    const [resultado] = await db.query(
      `UPDATE categories SET slug = ?, name = ?, image_url = ?, menu_group = ?, show_on_home = ?, sort_order = ?
       WHERE id = ?`,
      [crearSlug(slug || name), name.trim(), imagen, menu_group || 'comida',
       siNo(req.body.show_on_home), Number(sort_order) || 0, req.params.id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese slug' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al modificar la categoría' });
  }
});

routes.delete('/categories/:id', async (req, res) => {
  try {
    const [resultado] = await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al borrar la categoría' });
  }
});

// ================= PEDIDOS =================
routes.get('/orders', async (req, res) => {
  try {
    const [pedidos] = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100');
    const [items] = await db.query('SELECT * FROM order_items ORDER BY id');

    // A cada pedido le ponemos su lista de productos
    pedidos.forEach((pedido) => {
      pedido.items = items.filter((item) => item.order_id === pedido.id);
    });
    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los pedidos' });
  }
});

routes.patch('/orders/:id', async (req, res) => {
  const estados = ['pending', 'confirmed', 'done', 'cancelled'];
  if (!estados.includes(req.body.status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    const [resultado] = await db.query('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.json({ ok: true, status: req.body.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el pedido' });
  }
});

// ================= FEEDBACK =================
routes.get('/feedback', async (req, res) => {
  try {
    const [filas] = await db.query('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100');
    res.json(filas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el feedback' });
  }
});

// ================= REDES SOCIALES =================
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

routes.put('/site-settings/social-links', async (req, res) => {
  const links = {
    instagram: req.body.instagram || '',
    facebook: req.body.facebook || '',
    tiktok: req.body.tiktok || '',
  };
  try {
    await db.query(
      `INSERT INTO site_settings (setting_key, value) VALUES ('social_links', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [JSON.stringify(links)]
    );
    res.json(links);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar las redes sociales' });
  }
});

module.exports = routes;
