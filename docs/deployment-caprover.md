# Despliegue en CapRover

Guía para desplegar Lattente en CapRover. Sigue la misma convención que el
proyecto hermano `real-estate` (mismo `caprover-cli` pineado, mismo patrón de
tarball y de secrets en GitHub Actions).

## Arquitectura

Lattente es una **app única**: el mismo contenedor sirve el frontend estático
(`public/`) y la API Express (`server/`). No hay split de cliente/servidor
porque el frontend llama a rutas relativas (`/api/...`).

```
CapRover (nginx)  ->  lattente:3030  ->  postgres (app de CapRover)
                              |
                              +-- volumen persistente -> /app/data/uploads
```

## 1. Crear la app en CapRover

En el dashboard de CapRover, en **Apps → Create New App**:

| Campo | Valor |
| --- | --- |
| App Name | `lattente` (o el que prefieras) |
| Image Name | *(dejar vacío — se construye desde el código)* |
| Captain Definition Path | `captain-definition` |
| HTTP Port | `3030` |
| Instance Count | `1` |

> **HTTP Port debe ser `3030`.** CapRover no inyecta la variable `PORT`; el
> nginx hace proxy al puerto que definás en el panel. Si queda en `80` vas a
> ver un 502.

### Persistent volume (importante)

En **App Config → Persistent Volumes**, agregá:

| Volume Name | Container Path |
| --- | --- |
| `lattente-uploads` | `/app/data/uploads` |

Esto conserva las fotos que sube el admin en `/admin`. Sin este volumen,
cada redespliegue borra las imágenes subidas.

> Marcá **"Has Persistent Data"** al crear la app. En apps persistentes
> CapRover limita a 1 instancia y no deja cambiar el volumen después.

## 2. Base de datos

Copiá la app **PostgreSQL** de CapRover (una-click app) y configurá:

| Variable | Valor |
| --- | --- |
| `POSTGRES_USER` | `lattente` |
| `POSTGRES_PASSWORD` | *(una contraseña fuerte)* |
| `POSTGRES_DB` | `lattente` |

No hace falta exponer el puerto al host — la app lo alcanza por la red
interna de Docker usando el **nombre de la app** como host.

## 3. Variables de entorno de la app

En **App Config → Environment Variables**:

| Key | Value | Nota |
| --- | --- | --- |
| `NODE_ENV` | `production` | activa `trust proxy` por defecto |
| `PORT` | `3030` | coincide con el HTTP Port del panel |
| `DATABASE_URL` | `postgresql://lattente:<password>@lattente-db:5432/lattente` | `<password>` = la del paso 2, `<host>` = el nombre de la app de Postgres |
| `ADMIN_PASSWORD` | *(contraseña fuerte)* | **cambiá esto** |
| `JWT_SECRET` | `openssl rand -hex 32` | **cambiá esto** |
| `TRUST_PROXY` | `1` | 1 salto (nginx) |
| `UPLOAD_DIR` | `/app/data/uploads` | apunta al volumen persistente |
| `LOG_LEVEL` | `info` | opcional |

`JWT_EXPIRES_IN`, `LOGIN_RATE_LIMIT` y `API_RATE_LIMIT` tienen valores por
defecto razonables; solo configurarlos si los querés cambiar.

## 4. Deploy

### Opción A — desde GitHub Actions (recomendada)

Configurá estos **secrets** en el repositorio
(*Settings → Secrets and variables → Actions*):

| Secret | Valor |
| --- | --- |
| `CAPROVER_SERVER` | `https://captain.tudominio.com` |
| `CAPROVER_APP` | `lattente` |
| `CAPROVER_TOKEN` | *el token de la app, en App Config → Advanced → App Token* |

El workflow `.github/workflows/deploy-caprover.yaml` corre en cada push a
`main` que toque `server/`, `public/`, `db/`, el `Dockerfile` o el
`package.json`. También se puede disparar a mano con **Run workflow**.

Antes de dejar que el workflow despliegue, creá la app en el dashboard con
los pasos 1–3: el workflow solo hace el `caprover deploy`, no crea la app ni
sus variables.

### Opción B — desde la terminal

```bash
npm install -g caprover@2.2.3

caprover deploy \
  --caproverUrl "$CAPROVER_SERVER" \
  --appToken "$CAPROVER_TOKEN" \
  --appName "$CAPROVER_APP" \
  --tarFile ./deploy.tar
```

Para armar el tarball:

```bash
printf '%s\n' '{"schemaVersion":2,"dockerfilePath":"./Dockerfile"}' > ./captain-definition
tar --exclude='.git' --exclude='node_modules' --exclude='.env*' \
    -cf deploy.tar \
    captain-definition Dockerfile package.json package-lock.json server public db
```

> **`caprover-cli` está pineado en `2.2.3` a propósito.** Las versiones 2.4.x
> traen un `commander` estricto que entra en conflicto con el flag `-t`
> (que significa `--tarFile` y `--appToken` a la vez) y tiran un error al
> arrancar.

## 5. Verificar

```bash
# Health check (desde adentro del cluster o con un port mapping)
curl -fsS https://lattente.tudominio.com/api/health
# -> {"ok":true}

# Catálogo cargado
curl -fsS https://lattente.tudominio.com/api/products | head -c 200
```

Si `/api/health` devuelve `{"ok":true}` pero el sitio da **502**, el
**HTTP Port** de la app no está en `3030`.

Si `/api/health` da error de conexión, revisá que `DATABASE_URL` apunte al
nombre correcto de la app de Postgres y que la contraseña sea la misma.

## Comportamiento en el arranque

El contenedor ejecuta `node server/db/migrate.js && node server/index.js`:

1. **Espera a la base de datos** (30 intentos × 2 s). En CapRover la app y el
   Postgres arrancan como servicios separados, y en un arranque en frío la DB
   todavía no acepta conexiones.
2. **Aplica `db/schema.sql`** — todo es `CREATE TABLE IF NOT EXISTS`, así que
   es idempotente y nunca borra datos.
3. **Carga `db/seed.sql` solo si el catálogo está vacío.** El seed tiene
   `categories.slug` con constraint `UNIQUE`, así que correrlo sobre una base
   con datos fallaría. `db/reset.sql` (que sí hace `DROP TABLE`) está
   separado y solo lo usa `npm run db:init` en local.

Esto hace que **redesplegar sea seguro**: los pedidos y el feedback no se
borran.

## Comandos útiles

```bash
# Ver los logs de la app en CapRover
docker service logs captain-lattente --tail 100

# Reiniciar la app
docker service restart captain-lattente
```

## Resetear la base de datos (¡destructivo!)

Sólo en local:

```bash
npm run db:init
```

En producción, para resetear hay que entrar a la app de Postgres en CapRover
y borrar el volumen. **Esto borra pedidos, feedback y el catálogo.**

## Troubleshooting

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| 502 Bad Gateway | HTTP Port != 3030 | Cambiar el Container HTTP Port en el panel |
| Container restart loop | La DB no está lista | Ya hay reintentos; revisá `DATABASE_URL` |
| `ENOTFOUND <db-host>` | Nombre de la app de Postgres incorrecto | Usar el nombre exacto de la app en `DATABASE_URL` |
| Fotos desaparecen | Sin volumen persistente | Agregar el volumen `lattente-uploads` → `/app/data/uploads` |
| Todos los clientes comparten el mismo rate limit | `TRUST_PROXY` mal seteado | Poner `TRUST_PROXY=1` (número, no el string `"1"`) |
| 401 en `/api/admin` | `JWT_SECRET` cambió | El admin vuelve a hacer login |
