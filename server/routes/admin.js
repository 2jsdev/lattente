// Rutas del panel de administración (/api/admin/...)
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const pool = require('../conexion');

const routes = express.Router();

// ---------- CONTRASEÑA DEL ADMIN ----------
const ADMIN_PASSWORD = 'ravasco';

// Tokens de las sesiones abiertas (se borran al reiniciar el servidor)
const sesiones = new Set();

// ---------- SUBIDA DE FOTOS (multer) ----------
// Guarda las fotos en public/multimedia/uploads con un nombre único (fecha + número al azar)
const almacen = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'public', 'multimedia', 'uploads'),
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
// Los checkbox llegan como texto: "true" / "on" -> 1, cualquier otra cosa -> 0
function siNo(valor) {
  return valor === true || valor === 'true' || valor === 'on' || valor === '1' ? 1 : 0;
}

// Lista de fotos = las URLs escritas en el formulario (una por línea) + las fotos subidas
function listaDeFotos(body, archivos) {
  const fotos = [];
  String(body.images || body.image_url || '').split('\n').forEach((url) => {
    const limpia = url.trim();
    if (limpia && !fotos.includes(limpia)) fotos.push(limpia);
  });
  (archivos || []).forEach((archivo) => fotos.push('/multimedia/uploads/' + archivo.filename));
  return fotos;
}

// images se guarda como texto JSON en MySQL -> lo convertimos a lista
function leerFotos(producto) {
  let images = [];
  try {
    images = JSON.parse(producto.images || '[]');
  } catch (e) {
    images = [];
  }
  if (images.length === 0 && producto.image_url) images = [producto.image_url];
  producto.images = images;
  return producto;
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

// ================= PRODUCTOS =================
// VER PRODUCTOS (también los inactivos)
routes.get('/products', (req, res) => {
  const sql = `SELECT p.*, c.slug AS category_slug, c.name AS category_name
               FROM products p
               JOIN categories c ON c.id = p.category_id
               ORDER BY c.sort_order, p.id`;

  pool.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener los productos' });
    }
    res.json(rows.map(leerFotos));
  });
});

// AGREGAR PRODUCTO (subir.array recibe hasta 8 fotos del campo "photos")
routes.post('/products', subir.array('photos', 8), (req, res) => {
  const { category_id, name, description, price, currency } = req.body;
  if (!category_id || !name || price === undefined || price === '') {
    return res.status(400).json({ error: 'Categoría, nombre y precio son obligatorios' });
  }
  const fotos = listaDeFotos(req.body, req.files);

  const sql = `INSERT INTO products (category_id, name, description, price, currency, image_url, images, featured, active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const valores = [category_id, name.trim(), description || null, price, currency || 'Bs.',
    fotos[0] || null, JSON.stringify(fotos), siNo(req.body.featured), siNo(req.body.active)];

  pool.query(sql, valores, (err, resultado) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al crear el producto' });
    }
    res.status(201).json({ ok: true, id: resultado.insertId });
  });
});

// MODIFICAR PRODUCTO
routes.put('/products/:id', subir.array('photos', 8), (req, res) => {
  const { category_id, name, description, price, currency } = req.body;
  const fotos = listaDeFotos(req.body, req.files);

  const sql = `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, currency = ?,
                 image_url = ?, images = ?, featured = ?, active = ?
               WHERE id = ?`;
  const valores = [category_id, name.trim(), description || null, price, currency || 'Bs.',
    fotos[0] || null, JSON.stringify(fotos), siNo(req.body.featured), siNo(req.body.active),
    req.params.id];

  pool.query(sql, valores, (err, resultado) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al modificar el producto' });
    }
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ ok: true });
  });
});

// BORRAR PRODUCTO
routes.delete('/products/:id', (req, res) => {
  pool.query('DELETE FROM products WHERE id = ?', [req.params.id], (err, resultado) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al borrar el producto' });
    }
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ ok: true });
  });
});

// ================= CATEGORÍAS =================
// VER CATEGORÍAS (con cuántos productos tiene cada una)
routes.get('/categories', (req, res) => {
  const sql = `SELECT c.*, COUNT(p.id) AS product_count
               FROM categories c
               LEFT JOIN products p ON p.category_id = c.id
               GROUP BY c.id
               ORDER BY c.sort_order, c.id`;

  pool.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener las categorías' });
    }
    res.json(rows);
  });
});

// AGREGAR CATEGORÍA (subir.single recibe una foto del campo "photo")
routes.post('/categories', subir.single('photo'), (req, res) => {
  const { name, slug, menu_group, sort_order } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: 'El nombre y el slug son obligatorios' });
  }
  const imagen = req.file ? '/multimedia/uploads/' + req.file.filename : (req.body.image_url || null);

  const sql = `INSERT INTO categories (slug, name, image_url, menu_group, show_on_home, sort_order)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const valores = [slug.trim().toLowerCase(), name.trim(), imagen, menu_group || 'comida',
    siNo(req.body.show_on_home), Number(sort_order) || 0];

  pool.query(sql, valores, (err, resultado) => {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese slug' });
    }
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al crear la categoría' });
    }
    res.status(201).json({ ok: true, id: resultado.insertId });
  });
});

// MODIFICAR CATEGORÍA
routes.put('/categories/:id', subir.single('photo'), (req, res) => {
  const { name, slug, menu_group, sort_order } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: 'El nombre y el slug son obligatorios' });
  }
  const imagen = req.file ? '/multimedia/uploads/' + req.file.filename : (req.body.image_url || null);

  const sql = `UPDATE categories SET slug = ?, name = ?, image_url = ?, menu_group = ?, show_on_home = ?, sort_order = ?
               WHERE id = ?`;
  const valores = [slug.trim().toLowerCase(), name.trim(), imagen, menu_group || 'comida',
    siNo(req.body.show_on_home), Number(sort_order) || 0, req.params.id];

  pool.query(sql, valores, (err, resultado) => {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese slug' });
    }
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al modificar la categoría' });
    }
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json({ ok: true });
  });
});

// BORRAR CATEGORÍA (también borra sus productos: ON DELETE CASCADE en la base)
routes.delete('/categories/:id', (req, res) => {
  pool.query('DELETE FROM categories WHERE id = ?', [req.params.id], (err, resultado) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al borrar la categoría' });
    }
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json({ ok: true });
  });
});

// ================= PEDIDOS =================
// VER PEDIDOS (cada uno con su lista de productos)
routes.get('/orders', (req, res) => {
  pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100', (err, pedidos) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener los pedidos' });
    }

    pool.query('SELECT * FROM order_items ORDER BY id', (err, items) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener los pedidos' });
      }

      // A cada pedido le ponemos su lista de productos
      pedidos.forEach((pedido) => {
        pedido.items = items.filter((item) => item.order_id === pedido.id);
      });
      res.json(pedidos);
    });
  });
});

// CAMBIAR EL ESTADO DE UN PEDIDO
routes.patch('/orders/:id', (req, res) => {
  const estados = ['pending', 'confirmed', 'done', 'cancelled'];
  if (!estados.includes(req.body.status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  pool.query('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id], (err, resultado) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al actualizar el pedido' });
    }
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.json({ ok: true, status: req.body.status });
  });
});

// ================= REPORTE DEL DÍA =================
// GET /api/admin/report?fecha=2026-11-09  (sin fecha = hoy)
// Cuenta los pedidos de ese día y suma lo vendido. Los pedidos cancelados no cuentan.
routes.get('/report', (req, res) => {
  const fecha = req.query.fecha || new Date().toLocaleDateString('en-CA'); // en-CA da el formato AAAA-MM-DD

  // 1) Cantidad de pedidos y total vendido
  const resumenQuery = `
    SELECT COUNT(DISTINCT o.id) AS pedidos,
           COALESCE(SUM(i.unit_price * i.quantity), 0) AS total
    FROM orders o
    JOIN order_items i ON i.order_id = o.id
    WHERE DATE(o.created_at) = ? AND o.status <> 'cancelled'`;

  pool.query(resumenQuery, [fecha], (err, resumen) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener el reporte' });
    }

    // 2) Productos vendidos ese día, del más vendido al menos vendido
    const productosQuery = `
      SELECT i.product_name AS nombre,
             SUM(i.quantity) AS cantidad,
             SUM(i.unit_price * i.quantity) AS total
      FROM orders o
      JOIN order_items i ON i.order_id = o.id
      WHERE DATE(o.created_at) = ? AND o.status <> 'cancelled'
      GROUP BY i.product_name
      ORDER BY cantidad DESC`;

    pool.query(productosQuery, [fecha], (err, productos) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al obtener el reporte' });
      }
      res.json({
        fecha,
        pedidos: resumen[0].pedidos,
        total: Number(resumen[0].total),
        productos,
      });
    });
  });
});

// ================= FEEDBACK =================
routes.get('/feedback', (req, res) => {
  pool.query('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100', (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener el feedback' });
    }
    res.json(rows);
  });
});

// ================= REDES SOCIALES =================
routes.put('/redes', (req, res) => {
  const instagram = req.body.instagram || '';
  const facebook = req.body.facebook || '';
  const tiktok = req.body.tiktok || '';

  pool.query(
    'UPDATE redes SET instagram = ?, facebook = ?, tiktok = ? WHERE id = 1',
    [instagram, facebook, tiktok],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al guardar las redes sociales' });
      }
      res.json({ instagram, facebook, tiktok });
    }
  );
});

module.exports = routes;
