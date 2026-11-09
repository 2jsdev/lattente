// Rutas públicas: menú, productos, pedidos y feedback
const express = require('express');
const pool = require('../conexion');

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
  producto.images = images;
  producto.image_url = images[0] || null;
  return producto;
}

// VER CATEGORÍAS  (?home=true  ?group=frias)
routes.get('/categories', (req, res) => {
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

  pool.query(sql, valores, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener las categorías' });
    }
    res.json(rows);
  });
});

// VER UNA CATEGORÍA CON SUS PRODUCTOS
routes.get('/categories/:slug', (req, res) => {
  pool.query('SELECT * FROM categories WHERE slug = ?', [req.params.slug], (err, categorias) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener la categoría' });
    }
    if (categorias.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    const categoria = categorias[0];

    // Segunda consulta: los productos activos de esa categoría
    pool.query(
      'SELECT * FROM products WHERE category_id = ? AND active = 1 ORDER BY id',
      [categoria.id],
      (err, productos) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Error al obtener la categoría' });
        }
        categoria.products = productos.map(arreglarFotos);
        res.json(categoria);
      }
    );
  });
});

// VER PRODUCTOS  (?featured=true  ?category=slug)
routes.get('/products', (req, res) => {
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

  pool.query(sql, valores, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener los productos' });
    }
    res.json(rows.map(arreglarFotos));
  });
});

// CREAR UN PEDIDO (pedido + sus productos, en una transacción)
// Igual que el préstamo de la clase: si algo falla, rollback y no se guarda nada.
routes.post('/orders', (req, res) => {
  const { email, phone, address, quantity, notes, items } = req.body;

  if (!email || !phone || !address) {
    return res.status(400).json({ error: 'Debes ingresar email, celular y dirección' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Selecciona al menos un producto' });
  }

  // Obtener una conexión para realizar la transacción
  pool.getConnection((err, conn) => {
    if (err) {
      console.error('Error de conexión:', err);
      return res.status(500).json({ error: 'Error de conexión con la base de datos' });
    }

    // Deshace todo, suelta la conexión y responde con error
    function cancelar(mensaje, error) {
      conn.rollback(() => {
        conn.release();
        console.error(mensaje, error);
        res.status(500).json({ error: mensaje });
      });
    }

    conn.beginTransaction((err) => {
      if (err) {
        conn.release();
        return res.status(500).json({ error: 'Error al iniciar la transacción' });
      }

      // 1) Registrar el pedido
      const pedidoQuery = 'INSERT INTO orders (email, phone, address, quantity, notes) VALUES (?, ?, ?, ?, ?)';
      conn.query(pedidoQuery, [email, phone, address, quantity || 1, notes || null], (err, resultado) => {
        if (err) return cancelar('Error al registrar el pedido', err);
        const idPedido = resultado.insertId;

        // 2) Buscar el nombre y precio real de los productos en la base
        const ids = items.map((item) => item.productId);
        conn.query('SELECT id, name, price FROM products WHERE id IN (?)', [ids], (err, productos) => {
          if (err) return cancelar('Error al buscar los productos', err);

          // Una fila por producto: [order_id, product_id, product_name, unit_price, quantity]
          const filas = items.map((item) => {
            const producto = productos.find((p) => p.id === Number(item.productId));
            const nombre = producto ? producto.name : item.name || 'Producto';
            const precio = producto ? producto.price : Number(item.price) || 0;
            return [idPedido, producto ? producto.id : null, nombre, precio, item.quantity || 1];
          });

          // 3) Registrar los productos del pedido (todas las filas en un solo INSERT)
          const itemsQuery = `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
                              VALUES ?`;
          conn.query(itemsQuery, [filas], (err) => {
            if (err) return cancelar('Error al registrar los productos del pedido', err);

            // 4) Confirmar las operaciones
            conn.commit((err) => {
              if (err) return cancelar('Error al confirmar el pedido', err);
              conn.release();
              res.status(201).json({ ok: true, order: { id: idPedido, status: 'pending' } });
            });
          });
        });
      });
    });
  });
});

// ENVIAR FEEDBACK
routes.post('/feedback', (req, res) => {
  const { email, rating, comment } = req.body;
  const nota = Number(rating);

  if (!email || !(nota >= 1 && nota <= 5)) {
    return res.status(400).json({ error: 'Debes ingresar email y una calificación de 1 a 5' });
  }

  pool.query(
    'INSERT INTO feedback (email, rating, comment) VALUES (?, ?, ?)',
    [email, nota, comment || null],
    (err, resultado) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al guardar el feedback' });
      }
      res.status(201).json({ ok: true, feedback: { id: resultado.insertId } });
    }
  );
});

// VER REDES SOCIALES (para el footer)
routes.get('/redes', (req, res) => {
  pool.query('SELECT instagram, facebook, tiktok FROM redes WHERE id = 1', (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener las redes sociales' });
    }
    res.json(rows[0]);
  });
});

module.exports = routes;
