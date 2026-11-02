# Lattente

Sitio web de la cafetería **Lattente**: HTML, CSS y JS en el frontend, con un
servidor **Node.js + Express** y base de datos **MySQL (Laragon)**.

## Requisitos

- [Laragon](https://laragon.org/) (trae MySQL y HeidiSQL)
- Node.js 18 o superior

## Cómo levantarlo

1. **Abrir Laragon** y apretar **Start All** (tiene que estar MySQL en verde).
2. **Crear la base de datos:** en Laragon apretar **Database** (abre HeidiSQL),
   conectarse, ir a *Archivo → Cargar archivo SQL…*, elegir `db/lattente.sql`
   y ejecutarlo con **F9**. Esto crea la base `lattente` con las tablas y el menú.
3. **Instalar dependencias** (una sola vez), en la terminal de Laragon dentro
   de la carpeta del proyecto:

   ```bash
   npm install
   ```

4. **Arrancar el servidor:**

   ```bash
   npm start
   ```

5. Abrir <http://localhost:3030>

> Si MySQL de Laragon tiene contraseña, cambiarla en `server/conexion.js`.

## Estructura

```
lattente/
├── db/
│   └── lattente.sql        ← tablas + datos (importar en HeidiSQL)
├── public/                 ← páginas HTML, CSS, JS e imágenes
│   └── uploads/            ← fotos que se suben desde el admin
└── server/
    ├── index.js            ← arranca Express (puerto 3030)
    ├── conexion.js         ← conexión a MySQL
    └── routes/
        ├── public.js       ← API del menú, pedidos y feedback
        └── admin.js        ← API del panel de administración
```

## Páginas

| Ruta | Contenido |
| --- | --- |
| `/` | Portada, menú, pedido (`#orders`) y feedback (`#feedback`) |
| `/admin` | Panel para administrar productos, categorías, pedidos y feedback |

## Admin

Entrar a <http://localhost:3030/admin> con la contraseña **`lattente-admin`**
(se cambia en `server/routes/admin.js`).

## Tablas

| Tabla | Para qué |
| --- | --- |
| `categories` | Secciones del menú |
| `products` | Productos (precio, fotos, destacado, activo) |
| `orders` | Pedidos de los clientes |
| `order_items` | Productos de cada pedido |
| `feedback` | Calificaciones (1 a 5) y comentarios |
| `site_settings` | Links de redes sociales |

## API

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET | `/api/categories` | Lista de categorías (`?home=true`) |
| GET | `/api/categories/:slug` | Una categoría con sus productos |
| GET | `/api/products` | Productos activos (`?featured=true`) |
| POST | `/api/orders` | Crear un pedido |
| POST | `/api/feedback` | Enviar una calificación |
| POST | `/api/admin/login` | Iniciar sesión del admin |
| GET/POST/PUT/DELETE | `/api/admin/products` | CRUD de productos |
| GET/POST/PUT/DELETE | `/api/admin/categories` | CRUD de categorías |
| GET / PATCH | `/api/admin/orders` | Ver pedidos / cambiar estado |
| GET | `/api/admin/feedback` | Ver feedback |
