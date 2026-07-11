# Desplegar Ventory en producción — Neon (base de datos) + Vercel (app)

Ambos servicios tienen plan gratuito suficiente para un negocio: no piden tarjeta
de crédito y Neon incluye respaldos automáticos.

## Parte 1 — Crear la base de datos en Neon (~5 min)

1. Entra a **https://neon.tech** y pulsa **Sign up**. Puedes registrarte con tu
   cuenta de Google o GitHub (lo más rápido) o con email.
2. Al entrar te pedirá crear tu primer proyecto:
   - **Project name**: `ventory`
   - **Postgres version**: la que venga por defecto (16 o superior)
   - **Region**: `AWS US East (N. Virginia)` — es la de menor latencia desde Colombia.
3. Cuando el proyecto esté creado, pulsa el botón **Connect** (o "Connection
   details") en el panel principal. Ahí verás la cadena de conexión.
4. Copia **DOS** cadenas (hay un selector o interruptor "Connection pooling"):
   - Con **pooling activado** → esta será tu `DATABASE_URL`
     (contiene `-pooler` en el host, p. ej. `...@ep-xxx-pooler.us-east-1.aws.neon.tech/...`).
   - Con **pooling desactivado** (conexión directa) → esta será tu `DIRECT_URL`
     (mismo host pero sin `-pooler`).

   Ambas empiezan por `postgresql://` y terminan en `?sslmode=require`. Guárdalas;
   son las llaves de tu base de datos (no las compartas ni las subas a GitHub).

## Parte 2 — Desplegar en Vercel (~10 min)

1. Entra a **https://vercel.com** con tu cuenta y pulsa **Add New → Project**.
2. Importa el repositorio **Smonto-06/ventory** (si es la primera vez, Vercel te
   pedirá autorizar acceso a tu GitHub).
3. Antes de pulsar Deploy, abre la sección **Environment Variables** y agrega:

   | Nombre | Valor |
   |--------|-------|
   | `DATABASE_URL` | la cadena **pooled** de Neon |
   | `DIRECT_URL` | la cadena **directa** de Neon |
   | `NEXTAUTH_SECRET` | un secreto aleatorio largo (ver abajo) |
   | `NEXTAUTH_URL` | déjala pendiente; se agrega tras el primer deploy |

   Para `NEXTAUTH_SECRET`: en una terminal ejecuta `openssl rand -base64 32`,
   o escribe una frase aleatoria de más de 32 caracteres que no uses en ningún
   otro lugar.

4. Pulsa **Deploy**. El build ejecuta automáticamente las migraciones de la base
   de datos (`prisma migrate deploy`) — la primera vez crea todas las tablas.
5. Al terminar, Vercel te da la URL pública (p. ej. `https://ventory-xxx.vercel.app`).
   Vuelve a **Settings → Environment Variables**, agrega
   `NEXTAUTH_URL = https://ventory-xxx.vercel.app` y pulsa **Redeploy**
   (Deployments → ⋯ → Redeploy) para que el login quede configurado.

## Parte 3 — Primer uso

1. Abre `https://tu-app.vercel.app/register` y registra tu negocio — esto crea
   tu cuenta de **administrador**. No existe registro público de usuarios: los
   cajeros los creas tú desde **Ajustes → Gestión de usuarios**.
2. En **Ajustes** configura moneda, IVA % (incluido en el precio) y la base de
   caja por defecto.
3. Crea tus categorías y productos en **Productos** (o pide ayuda para importar
   desde un Excel/CSV).
4. Abre caja y ¡a vender!

## Notas de operación

- **Cada push a la rama principal redespliega automáticamente** la app en Vercel.
- **Respaldos**: Neon guarda historial punto-en-el-tiempo (restore desde su panel).
  Aun así, exporta un respaldo manual de vez en cuando:
  `pg_dump "<DIRECT_URL>" > respaldo-$(date +%F).sql`
- **Dominio propio**: en Vercel → Settings → Domains puedes conectar tu dominio
  (p. ej. `pos.tunegocio.com`) — recuerda actualizar `NEXTAUTH_URL` si lo cambias.
- El plan gratuito de Neon "duerme" la base tras unos minutos sin uso; la primera
  petición de la mañana puede tardar 1-2 segundos extra mientras despierta. Es
  normal y no se pierde ningún dato.
