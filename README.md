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

- **`businesses`** — Negocio (tenant raíz) con ajustes: moneda, IVA % incluido, apertura por defecto
- **`branches`** — Sucursales del negocio
- **`users`** — Usuarios con roles (`ADMIN`, `SUPERVISOR`, `CASHIER`, `SELLER`); solo el admin crea cuentas
- **`products`** — Catálogo con SKU, código de barras, precio, costo y proveedor
- **`categories`** — Categorías por negocio (solo eliminables sin productos)
- **`suppliers`** — Proveedores
- **`inventory`** — Stock por producto y sucursal (con stock mínimo y alerta)
- **`inventory_movements`** — Auditoría de cada cambio de inventario (venta, compra, devolución, ajuste)
- **`sales`** / **`sale_items`** — Ventas con folio `F-XXXXXX` por sucursal, descuento por ítem (%), descuento global ($ o %), costo snapshot y anulación
- **`sale_payments`** — Cobro combinado (Efectivo + Tarjeta + Transferencia con montos, o Crédito exclusivo)
- **`sale_returns`** / **`sale_return_items`** — Devoluciones y cambios por artículo
- **`purchases`** / **`purchase_items`** / **`purchase_payments`** — Compras a proveedor (contado / transferencia / crédito con saldo pendiente y abonos)
- **`customer_payments`** — Abonos de clientes con saldo de crédito
- **`cash_sessions`** — Turnos de caja (apertura → cierre con arqueo y diferencia)
- **`cash_movements`** — Ingresos/gastos de caja (base de caja, abonos, pagos a proveedor, devoluciones, anulaciones…)
- **`held_sales`** / **`held_purchases`** — Ventas y compras en espera
- **`audit_logs`** — Log de acciones sensibles

## API principal

| Recurso | Endpoints |
|---------|-----------|
| Autenticación | `POST /api/auth/register` (alta del negocio), NextAuth login, `POST /api/auth/pin-login` |
| Usuarios | `GET/POST /api/users` · `PUT /api/users/[id]` (solo ADMIN; activar/desactivar, roles) |
| Productos | `GET/POST /api/products` · `GET/PUT/DELETE /api/products/[id]` · `/api/products/search` |
| Categorías | `GET/POST /api/categories` · `PUT/DELETE /api/categories/[id]` |
| Proveedores | `GET/POST /api/suppliers` · `PUT/DELETE /api/suppliers/[id]` |
| Compras | `GET/POST /api/purchases` · `POST /api/purchases/[id]/payments` (abono) |
| Clientes | `GET/POST /api/customers` · `GET/PUT/DELETE /api/customers/[id]` · `POST /api/customers/[id]/payments` (abono de crédito) |
| Ventas | `GET/POST /api/sales` · `POST /api/sales/[id]/return` (devolución/cambio) · `POST /api/sales/[id]/void` (anulación) |
| Caja | `POST /api/cash-registers/open` · `GET /api/cash-registers/current` · `POST /api/cash-registers/[id]/close` (cierre + apertura del siguiente turno) · `GET /api/shifts` (historial) |
| Movimientos | `GET/POST /api/cash-movements` (ingreso/gasto con descripción y comentario) |
| Inventario | `POST /api/inventory/adjust` (conteo físico) · `POST /api/inventory/transfer` · `GET /api/inventory/low-stock` · `GET /api/inventory/movements` |
| Esperas | `GET/POST /api/held-sales` · `DELETE /api/held-sales/[id]` · ídem `/api/held-purchases` |
| Reportes | `GET /api/reports/daily?date=YYYY-MM-DD` (ventas por hora/método, top 5, utilidad) · `GET /api/dashboard` |
| Ajustes | `GET/PUT /api/settings` (nombre, moneda, IVA %, apertura por defecto) |

### Reglas de negocio (del prototipo, centralizadas en `lib/pos.ts`)

- Dinero en **COP enteros**; IVA **incluido** en el precio (desglose informativo `total × pct / (100 + pct)`).
- Descuento por artículo en % y descuento global en $ o % (excluyentes); el total nunca baja de 0.
- **Cobro combinado**: cada método no-efectivo lleva monto y el restante se cobra en efectivo; cambio = recibido − restante. Crédito es exclusivo y suma al saldo del cliente.
- **Saldo esperado de caja** = apertura + ventas del turno (no anuladas) + ingresos − gastos.
- **Compra**: `stock += qty`, costo y precio nuevos, proveedor; contado → gasto de caja; crédito → saldo pendiente con abonos.
- **Devolución** regresa stock y genera gasto de caja; **cambio** regresa stock y devuelve un crédito que se aplica como descuento en la nueva venta; **anulación** regresa el stock restante y genera gasto por lo no devuelto (si fue a crédito, revierte el saldo del cliente).
- Toda operación que toca stock/caja/saldos es **transaccional** y queda auditada.

### ¿Cómo se actualiza el inventario si Ventory corre en el navegador?

El navegador nunca modifica el stock directamente: cada venta/compra/devolución es una
petición a la API, y el servidor aplica el cambio dentro de una **transacción de
PostgreSQL** (verifica stock disponible, descuenta, registra el movimiento y la venta
como una sola unidad). Si dos cajeros venden al mismo tiempo, la base de datos
serializa los cambios y no se pierde ninguna unidad; si no hay stock suficiente la API
responde `422 INSUFFICIENT_STOCK`. Cada cambio queda en `inventory_movements` con
antes/después, usuario y motivo.

## Prototipo (especificación funcional)

`docs/prototype/` contiene el prototipo HTML aprobado (`Ventory POS - Frontend completo.html`),
su fuente (`Ventory POS.dc.html`) y el handoff (`HANDOFF-CLAUDE-CODE.md`). **Es la fuente de
verdad de UI, flujos y cálculos**: el backend replica esas reglas y el frontend definitivo debe
construirse 1:1 contra ese diseño.

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
