# Ventory POS

Sistema de punto de venta e inventario para PyMEs latinoamericanas. Construido con Next.js 14, PostgreSQL, y Prisma ORM.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend / Backend | Next.js 14 (App Router) + TypeScript |
| Estilos | Tailwind CSS |
| Base de datos | PostgreSQL 16 |
| ORM | Prisma 5 |
| Autenticación | NextAuth.js v4 (multi-tenant por `businessId`) |
| Hosting | Railway |
| CI/CD | GitHub Actions |
| Monitoreo | Sentry + Uptime Kuma |
| Almacenamiento | Cloudflare R2 |

## Requisitos previos

- Node.js 20+
- PostgreSQL 16 corriendo localmente **o** una instancia en Railway
- npm 10+

## Configuración local

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd ventory

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.example .env.local

# 4. Editar .env.local con tus credenciales reales (ver sección abajo)

# 5. Ejecutar migraciones de base de datos
npm run db:migrate

# 6. (Opcional) Abrir Prisma Studio para inspeccionar la DB
npm run db:studio

# 7. Iniciar servidor de desarrollo
npm run dev
```

El servidor estará disponible en [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores:

```env
# Base de datos
DATABASE_URL=postgresql://ventory:ventory_dev@localhost:5432/ventory_dev

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<genera con: openssl rand -base64 32>
```

Las demás variables (Sentry, R2, Railway) son opcionales en desarrollo local.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con hot-reload |
| `npm run build` | Build de producción |
| `npm run start` | Iniciar build de producción |
| `npm run lint` | Verificar estilo de código con ESLint |
| `npm run type-check` | Verificar tipos con TypeScript |
| `npm test` | Ejecutar suite de pruebas |
| `npm run db:generate` | Generar cliente Prisma |
| `npm run db:migrate` | Ejecutar migraciones pendientes |
| `npm run db:push` | Push de schema sin migración (solo dev) |
| `npm run db:studio` | Abrir Prisma Studio |

## Estructura del proyecto

```
ventory/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   └── auth/          # NextAuth endpoints
│   ├── dashboard/         # Dashboard de caja y reportes
│   ├── login/             # Pantalla de login
│   ├── register/          # Registro de negocio
│   └── layout.tsx
├── lib/
│   ├── auth.ts            # Configuración de NextAuth
│   ├── db.ts              # Singleton de PrismaClient
│   └── types.ts           # Tipos globales y extensiones de NextAuth
├── prisma/
│   ├── schema.prisma      # Modelos de base de datos
│   └── migrations/        # Historial de migraciones SQL
├── .env.example           # Plantilla de variables de entorno
└── .github/workflows/     # CI/CD (lint, test, deploy)
```

## Modelos de base de datos

El schema incluye los modelos principales del ciclo de venta:

- **`businesses`** — Negocio (tenant raíz)
- **`branches`** — Sucursales del negocio
- **`users`** — Usuarios con roles (`ADMIN`, `SUPERVISOR`, `CASHIER`, `SELLER`)
- **`products`** — Catálogo de productos con SKU, precio y tasa de impuesto
- **`categories`** — Categorías de productos por negocio
- **`inventory`** — Stock por producto y sucursal
- **`inventory_movements`** — Auditoría de cada cambio de inventario
- **`sales`** — Ventas con folio único por sucursal
- **`sale_items`** — Líneas de cada venta
- **`cash_sessions`** — Sesiones de caja (apertura → cierre)
- **`audit_logs`** — Log de acciones sensibles

## Flujo de caja (ciclo principal)

```
Login → Abrir sesión de caja → Registrar venta → Actualizar inventario → Cerrar caja → Logout
```

Cada venta ejecuta una transacción atómica que:
1. Crea el registro de venta + líneas
2. Decrementa inventario por producto
3. Registra el movimiento de inventario
4. Asocia la venta a la sesión de caja activa

## Deploy

El proyecto se despliega automáticamente en Railway:

- **Staging**: push a `main` → GitHub Actions → Railway staging
- **Producción**: workflow manual con confirmación `deploy`

Ver `.github/workflows/` para la configuración completa.

## Contribuir

1. Crear branch desde `develop`
2. Abrir PR hacia `develop` (CI corre automáticamente)
3. Revisión y merge → deploy automático a staging
