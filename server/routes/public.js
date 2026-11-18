// Rutas públicas: menú, productos, usuarios, pedidos y feedback
const express = require('express');
const crypto = require('crypto');
const pool = require('../conexion');

const routes = express.Router();

// ---------- USUARIOS: contraseñas y sesión ----------
// La contraseña nunca se guarda tal cual: se guarda "sal:hash".
// La sal es un texto al azar; el hash se calcula con scrypt (viene con Node).
function encriptar(password) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return sal + ':' + hash;
}

// Calcula el hash de nuevo con la misma sal y compara
function passwordCorrecta(password, guardada) {
  const [sal, hash] = guardada.split(':');
  return crypto.scryptSync(password, sal, 64).toString('hex') === hash;
}

// "Guardia": deja pasar solo si el navegador manda un token de un usuario registrado.
// Se usa en las rutas de pedidos y feedback.
function requiereUsuario(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Debes registrarte o ingresar para continuar' });
  }

  pool.query('SELECT id, name, email, phone FROM users WHERE token = ?', [token], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al verificar la sesión' });
    }
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Tu sesión venció, vuelve a ingresar' });
    }
    req.usuario = rows[0]; // la ruta siguiente sabe quién es
    next();
  });
}

// Devuelve los datos del usuario (sin la contraseña) junto con su token nuevo
function respuestaDeSesion(usuario, token) {
  return { token, usuario: { name: usuario.name, email: usuario.email, phone: usuario.phone } };
}

// REGISTRARSE
routes.post('/register', (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'Completa nombre, correo, celular y contraseña' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const query = 'INSERT INTO users (name, email, phone, password, token) VALUES (?, ?, ?, ?, ?)';

  pool.query(query, [name, email, phone, encriptar(password), token], (err) => {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ese correo ya está registrado, ingresa con tu contraseña' });
    }
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al registrar el usuario' });
    }
    res.status(201).json(respuestaDeSesion({ name, email, phone }, token));
  });
});

// INGRESAR (iniciar sesión)
routes.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Ingresa tu correo y tu contraseña' });
  }

  pool.query('SELECT * FROM users WHERE email = ?', [email], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al ingresar' });
    }
    if (rows.length === 0 || !passwordCorrecta(password, rows[0].password)) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Cada vez que ingresa se crea un token nuevo y se guarda en su fila
    const usuario = rows[0];
    const token = crypto.randomBytes(24).toString('hex');
    pool.query('UPDATE users SET token = ? WHERE id = ?', [token, usuario.id], (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al ingresar' });
      }
      res.json(respuestaDeSesion(usuario, token));
    });
  });
});

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
routes.post('/orders', requiereUsuario, (req, res) => {
  const { address, quantity, notes, items } = req.body;
  // El correo y el celular salen de la cuenta del usuario (los puso al registrarse)
  const { email, phone } = req.usuario;

  if (!address) {
    return res.status(400).json({ error: 'Debes ingresar la dirección de entrega' });
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
      const pedidoQuery =
        'INSERT INTO orders (user_id, email, phone, address, quantity, notes) VALUES (?, ?, ?, ?, ?, ?)';
      conn.query(pedidoQuery, [req.usuario.id, email, phone, address, quantity || 1, notes || null], (err, resultado) => {
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

// VER COMENTARIOS (los que se muestran en la página, con el nombre de quien opinó)
routes.get('/feedback', (req, res) => {
  const query = `
    SELECT f.id, f.rating, f.comment, f.created_at, u.name
    FROM feedback f
    LEFT JOIN users u ON u.id = f.user_id
    WHERE f.comment IS NOT NULL AND f.comment <> ''
    ORDER BY f.created_at DESC
    LIMIT 12`;

  pool.query(query, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener los comentarios' });
    }
    res.json(rows);
  });
});

// ENVIAR FEEDBACK (solo usuarios registrados; el correo sale de su cuenta)
routes.post('/feedback', requiereUsuario, (req, res) => {
  const { rating, comment } = req.body;
  const nota = Number(rating);

  if (!(nota >= 1 && nota <= 5)) {
    return res.status(400).json({ error: 'Elige una calificación de 1 a 5' });
  }

  pool.query(
    'INSERT INTO feedback (user_id, email, rating, comment) VALUES (?, ?, ?, ?)',
    [req.usuario.id, req.usuario.email, nota, comment || null],
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
