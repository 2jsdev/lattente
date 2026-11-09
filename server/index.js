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

// Panel de administración (sin .html en la URL)
app.get('/admin', (req, res) => res.sendFile(path.join(carpetaPublic, 'admin.html')));

// Archivos estáticos: HTML, CSS, JS y la carpeta multimedia (imágenes, videos y fotos subidas)
app.use(express.static(carpetaPublic));

// Fotos subidas antes del cambio de carpetas (en la base quedaron como /uploads/...)
app.use('/uploads', express.static(path.join(carpetaPublic, 'multimedia', 'uploads')));

app.listen(PUERTO, () => {
  console.log(`Lattente corriendo en http://localhost:${PUERTO}`);
});
