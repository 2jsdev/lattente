// Conexión a MySQL de Laragon
// Laragon por defecto: usuario "root" y SIN contraseña.
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'lattente',
  port: 3306,
  connectionLimit: 10,
});

// Probar la conexión al arrancar
pool.getConnection((err, conn) => {
  if (err) {
    console.error('No se pudo conectar a MySQL. ¿Está Laragon encendido (Start All)?', err.message);
    return;
  }
  console.log('Conectado a MySQL (base de datos lattente)');
  conn.release();
});

module.exports = pool;
