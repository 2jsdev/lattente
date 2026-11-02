# Lattente

Sitio web de la cafetería **Lattente**: HTML, CSS y JS en el frontend, con un
servidor **Node.js + Express** y base de datos **MySQL (Laragon)**.

```
Navegador (HTML + JS con fetch)  →  Node/Express (localhost:3030)  →  MySQL de Laragon
```

Esta guía explica cómo hacerlo correr **en tu propia computadora**, paso a paso.

---

## 1. Requisitos

| Programa | Para qué | Dónde conseguirlo |
| --- | --- | --- |
| **Laragon** | Trae MySQL, HeidiSQL (para ver la base) y Node.js | <https://laragon.org/download/> |
| **Node.js 18 o superior** | Ejecuta el servidor | Ya viene en Laragon (menú **Node.js**) |
| Git *(opcional)* | Descargar el proyecto con `git clone` | <https://git-scm.com/> |

> **No hace falta Apache ni PHP.** El servidor de este proyecto es Node.
> De Laragon solo usamos **MySQL**, **HeidiSQL** y su **Terminal**.

Para comprobar que tienes Node, abre la **Terminal de Laragon** (botón
*Terminal*) y escribe:

```bash
node -v
npm -v
```

Si los dos muestran un número de versión, está todo bien.

---

## 2. Descargar el proyecto

Lo más cómodo es ponerlo dentro de `C:\laragon\www`, porque la Terminal de
Laragon abre directo en esa carpeta.

**Opción A — con Git** (en la Terminal de Laragon):

```bash
cd C:\laragon\www
git clone https://github.com/2jsdev/lattente.git
cd lattente
```

**Opción B — sin Git:** en GitHub, botón **Code → Download ZIP**,
descomprimirlo y mover la carpeta a `C:\laragon\www\lattente`.

> Si la carpeta quedó como `lattente-main`, renómbrala a `lattente`
> (no es obligatorio, pero así coincide con esta guía).

---

## 3. Encender MySQL

1. Abrir **Laragon**.
2. Apretar **Start All**.
3. Esperar a que **MySQL** aparezca encendido (en verde / con su puerto `3306`).

> MySQL tiene que estar encendido **siempre** que uses la app. Si apagas
> Laragon, la página carga pero no muestra productos.

---

## 4. Cargar la base de datos

El archivo [`db/lattente.sql`](db/lattente.sql) crea la base `lattente`, sus
6 tablas y el menú de ejemplo (16 categorías y 32 productos).

> ⚠️ **El script borra y vuelve a crear la base `lattente`.** Si ya la tenías,
> se pierden los pedidos, el feedback y los cambios hechos desde el admin.
> Úsalo también para "resetear" la base cuando quieras empezar de cero.

### Opción A — con HeidiSQL (recomendada)

1. En Laragon apretar **Database** → se abre **HeidiSQL**.
2. En la ventana de sesiones, elegir la sesión de Laragon y apretar **Abrir**.
   - Usuario: `root`
   - Contraseña: *(vacía)*
   - Puerto: `3306`
3. Menú **Archivo → Cargar archivo SQL…** y elegir
   `C:\laragon\www\lattente\db\lattente.sql`.
   - Si pregunta *"¿Cargar el archivo en el editor o ejecutarlo directamente?"*,
     elegir **cargarlo en el editor**.
4. Apretar **F9** (o el botón ▶ *Ejecutar*) para correr **todo** el script.
5. Clic derecho en el panel izquierdo → **Actualizar** (o **F5**).
   Debe aparecer la base **`lattente`** con estas tablas:
   `categories`, `feedback`, `order_items`, `orders`, `products`, `site_settings`.

> Si ves letras raras (por ejemplo `CafÃ©` en vez de `Café`), vuelve a cargar
> el archivo y, en el diálogo de abrir, elige la codificación **UTF-8**.

### Opción B — desde la Terminal de Laragon

Dentro de la carpeta del proyecto:

```bash
mysql -u root --default-character-set=utf8mb4 < db\lattente.sql
```

Si no muestra nada, salió bien. Para comprobarlo:

```bash
mysql -u root lattente -e "SELECT COUNT(*) AS productos FROM products"
```

Tiene que responder **32**.

---

## 5. Instalar las dependencias

Solo **una vez** (o cuando cambie `package.json`). En la Terminal de Laragon,
dentro de la carpeta del proyecto:

```bash
npm install
```

Esto crea la carpeta `node_modules/` con Express, mysql2, cors y multer.

---

## 6. Arrancar el servidor

```bash
npm start
```

Si todo está bien, la terminal muestra:

```
Lattente corriendo en http://localhost:3030
Conectado a MySQL (base de datos lattente)
```

Abrir en el navegador: **<http://localhost:3030>**

> **Mientras programas** usa `npm run dev`: reinicia el servidor solo cada
> vez que guardas un archivo de `server/`.
>
> Para **apagar** el servidor: `Ctrl + C` en la terminal.

---

## 7. Entrar al admin

Abrir **<http://localhost:3030/admin>** y escribir la contraseña
**`lattente-admin`**.

- Se cambia en [`server/routes/admin.js`](server/routes/admin.js)
  (constante `ADMIN_PASSWORD`).
- La sesión se guarda en la memoria del servidor: si lo reinicias (o
  `npm run dev` lo reinicia al guardar), hay que volver a iniciar sesión.
- Las fotos que se suben desde el admin quedan en `public/uploads/`
  **solo en tu computadora** (esa carpeta no se sube a Git).

---

## Resumen rápido (cada vez que quieras usar la app)

1. Laragon → **Start All**
2. Laragon → **Terminal** → `cd lattente`
3. `npm start`
4. Abrir <http://localhost:3030>

---

## Problemas comunes

| Lo que ves | Por qué pasa | Cómo arreglarlo |
| --- | --- | --- |
| `npm` / `node` *no se reconoce como un comando* | Estás en una terminal normal de Windows y el Node de Laragon no está en el PATH | Usa la **Terminal de Laragon**. O en Laragon: *Menú → Tools → Path → Add Laragon to Path* y abre una terminal nueva |
| `No se pudo conectar a MySQL. ¿Está Laragon encendido?` con `ECONNREFUSED` | MySQL está apagado | Laragon → **Start All** y reinicia el servidor |
| `Unknown database 'lattente'` | No se importó la base | Hacer el [paso 4](#4-cargar-la-base-de-datos) |
| `Access denied for user 'root'@'localhost'` | Tu MySQL tiene contraseña | Ponerla en `password` de [`server/conexion.js`](server/conexion.js) |
| `Error: listen EADDRINUSE :::3030` | Ya hay otro servidor usando el puerto 3030 (quizás otra terminal con `npm start`) | Cerrar la otra terminal, o cambiar `PUERTO` en [`server/index.js`](server/index.js) |
| `Cannot find module 'express'` | Falta instalar dependencias | `npm install` |
| La página carga pero sin productos | MySQL apagado o base sin importar | Mirar los mensajes en la terminal donde corre `npm start` |
| Acentos raros (`CafÃ©`) | El SQL se importó sin UTF-8 | Volver a importar con UTF-8 (paso 4) |
| MySQL no arranca en Laragon | Otro MySQL (XAMPP, MySQL Workbench…) ocupa el puerto 3306 | Cerrar el otro programa o su servicio de Windows |

---

## Estructura

```
lattente/
├── db/
│   └── lattente.sql        ← tablas + datos (importar en HeidiSQL)
├── public/                 ← páginas HTML, CSS, JS e imágenes
│   └── uploads/            ← fotos que se suben desde el admin
└── server/
    ├── index.js            ← arranca Express (puerto 3030)
    ├── conexion.js         ← conexión a MySQL (usuario, contraseña, base)
    └── routes/
        ├── public.js       ← API del menú, pedidos y feedback
        └── admin.js        ← API del panel de administración
```

## Configuración

Todo está escrito directamente en el código (no hay archivo `.env`):

| Qué | Valor | Dónde se cambia |
| --- | --- | --- |
| Puerto del servidor | `3030` | `PUERTO` en `server/index.js` |
| Usuario de MySQL | `root` | `server/conexion.js` |
| Contraseña de MySQL | *(vacía)* | `server/conexion.js` |
| Nombre de la base | `lattente` | `server/conexion.js` |
| Contraseña del admin | `lattente-admin` | `ADMIN_PASSWORD` en `server/routes/admin.js` |

## Páginas

| Ruta | Contenido |
| --- | --- |
| `/` | Portada, menú, pedido (`#orders`) y feedback (`#feedback`) |
| `/admin` | Panel para administrar productos, categorías, pedidos y feedback |

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
| GET | `/api/categories` | Lista de categorías (`?home=true`, `?group=frias`) |
| GET | `/api/categories/:slug` | Una categoría con sus productos |
| GET | `/api/products` | Productos activos (`?featured=true`, `?category=slug`) |
| POST | `/api/orders` | Crear un pedido |
| POST | `/api/feedback` | Enviar una calificación |
| GET | `/api/site-settings/social-links` | Links de redes sociales (footer) |
| POST | `/api/admin/login` | Iniciar sesión del admin |
| GET/POST/PUT/DELETE | `/api/admin/products` | CRUD de productos |
| GET/POST/PUT/DELETE | `/api/admin/categories` | CRUD de categorías |
| GET / PATCH | `/api/admin/orders` | Ver pedidos / cambiar estado |
| GET | `/api/admin/feedback` | Ver feedback |
| GET / PUT | `/api/admin/site-settings/social-links` | Ver / cambiar redes sociales |

Para probar la API sin el navegador, abre por ejemplo
<http://localhost:3030/api/categories>: debe mostrar la lista en JSON.
