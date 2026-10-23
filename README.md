# Lattente

Réplica del sitio Canva de **Lattente**: HTML, CSS y JS en el frontend, con API Node.js + PostgreSQL.

## Requisitos

- Node.js 18+
- Docker (para Postgres) o una instancia local de PostgreSQL

## Arranque rápido

```bash
# 1. Base de datos (Postgres en localhost:5433)
docker compose up -d

# 2. Dependencias
cp .env.example .env
npm install

# 3. (Opcional si la DB ya existía) reinicializar schema + seed
npm run db:init

# 4. Servidor
npm run dev
```

Abre [http://localhost:3030](http://localhost:3030).

### Con Docker (todo junto)

```bash
docker compose up --build
```

Levanta Postgres + la app. La app espera a la base de datos, aplica el schema
y carga el catálogo si está vacío.

## Despliegue

Production corre en **CapRover** con una imagen única (frontend + API en el
mismo contenedor).

- Guía completa: **[docs/deployment-caprover.md](docs/deployment-caprover.md)**
- Deploy automático con GitHub Actions: `.github/workflows/deploy-caprover.yaml`

Los secretos de deploy (`CAPROVER_SERVER`, `CAPROVER_APP`, `CAPROVER_TOKEN`)
se configuran en *Settings → Secrets and variables → Actions*.

## Páginas

| Ruta | Contenido |
| --- | --- |
| `/` | Home (portada) |
| `/menu` | Menú por categorías (+ detalle con `?category=...`, búsqueda con `?q=...`) |
| `/orders` | Catálogo con búsqueda + resumen de pedido |
| `/feedback` | Calificación del servicio |
| `/admin` | CMS (productos, categorías, pedidos, feedback) |

En todas las páginas la cabecera es la misma: logo **Lattente** (enlaza a la
portada), navegación *Menú / Pedido / Feedback* y el carrito. El buscador solo
aparece en la portada y en el menú.

## Admin / CMS

1. Abrí [http://localhost:3030/admin](http://localhost:3030/admin)
2. Entrá con la contraseña de `ADMIN_PASSWORD` en `.env` (por defecto `lattente-admin`)

Desde el panel podés crear/editar/borrar productos y categorías (precios, fotos con Multer, orden, visibilidad en home), ver pedidos y actualizar su estado, y revisar feedback.

El panel tiene cuatro pestañas:

| Pestaña | Qué se hace ahí |
| --- | --- |
| **Productos** | Crear/editar/borrar productos. Se sube **varias fotos a la vez** (`Subir fotos`): la primera es la portada y el resto se ven en la galería del producto. `Destacado` lo muestra en la home. |
| **Categorías** | Secciones del menú (Calientes, Frías, Comida, Extras, Creaciones). El `Grupo` decide en qué filtro cae y `Home` si aparece en la portada. |
| **Pedidos** | Listado de pedidos con datos del cliente y total. El `estado` se cambia a `confirmed`, `done` o `cancelled`. |
| **Feedback** | Calificaciones y comentarios que dejan los clientes. |

Fotos: en el listado de productos se ven en una rejilla 2×2 y al hacer clic se abren
a pantalla completa (con zoom, swipe y flechas del teclado).

Auth admin: JWT (`jsonwebtoken`) vía `Authorization: Bearer <token>`.

Backend también usa:

- **zod** — validación de body/query/params
- **helmet** — headers de seguridad
- **morgan** + **pino** — logs HTTP y de aplicación
- **express-rate-limit** — límite en API y login
- **multer** + **sharp** — subida y optimización de fotos (WebP)

## API

- `GET /api/categories`
- `GET /api/categories/:slug`
- `GET /api/products?featured=true`
- `POST /api/orders`
- `POST /api/feedback`
- `POST /api/admin/login` + rutas protegidas bajo `/api/admin/*`
- Subida de fotos: `multipart/form-data` en productos (`photos`) y categorías (`photo`)

## Notas

- El carrito vive en `localStorage` y se envía al crear un pedido.
- Precios en bolivianos (`Bs.`), con dirección de Cochabamba del diseño original.
- Cambiá `ADMIN_PASSWORD` y `JWT_SECRET` antes de desplegar.
- Las imágenes subidas quedan en `public/uploads/` en local. En producción van
  a `UPLOAD_DIR` (por defecto `/app/data/uploads`), que debe ser un volumen
  persistente de CapRover para no perderlas al redesplegar.
- `npm run db:init` **borra** la base de datos (reset local). En producción el
  arranque usa `npm run db:migrate`, que sólo aplica el schema y carga el
  catálogo si la base está vacía — redesplegar nunca borra pedidos ni feedback.

