const express = require('express');
const cors = require('cors');
const path = require('path');

const rutasPublicas = require('./routes/public');
const rutasAdmin = require('./routes/admin');

const app = express();
const PUERTO = 3030;
const carpetaPublic = path.join(__dirname, '..', 'public');

app.use(cors());
app.use(express.json());

// API
app.use('/api/admin', rutasAdmin);
app.use('/api', rutasPublicas);

// Páginas (URLs sin .html) — la parte pública vive en index
app.get('/orders', (req, res) => res.redirect(301, '/#orders'));
app.get('/feedback', (req, res) => res.redirect(301, '/#feedback'));
app.get('/admin', (req, res) => res.sendFile(path.join(carpetaPublic, 'admin.html')));
app.get('/menu', (req, res) => res.redirect(301, '/#menu'));
app.get('/orders.html', (req, res) => res.redirect(301, '/#orders'));
app.get('/feedback.html', (req, res) => res.redirect(301, '/#feedback'));


// Archivos estáticos: HTML, CSS, JS, imágenes y fotos subidas
app.use(express.static(carpetaPublic));

app.listen(PUERTO, () => {
  console.log(`Lattente corriendo en http://localhost:${PUERTO}`);
});
