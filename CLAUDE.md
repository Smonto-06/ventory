# Ventory — contexto del proyecto

POS web para retail colombiano que Samuel (GitHub `Smonto-06`) vende como SaaS.
Precios en COP enteros, IVA **incluido** en el precio. Idioma de todo (UI,
commits, comentarios): **español**.

## Arquitectura

- **Stack**: Next.js 14 App Router + TypeScript + Prisma 5 + PostgreSQL.
  NextAuth v4 (JWT). Estilos inline (sin Tailwind en `/app/app`), fuente
  Poppins, acento `#6366F1`. Iconos: `components/Icono.tsx` (SVG de línea
  propios — **nunca emojis** en la UI).
- **Producción**: GitHub → Vercel (deploy automático al mergear a `master`;
  el build corre `prisma migrate deploy`) → Neon PostgreSQL.
  URL: `https://ventory-ten.vercel.app`.
- **Multi-tenant**: todo query filtra por `businessId` (o
  `branch: { businessId }`). Inventario con clave `productId_branchId`.
- La SPA vive en `app/app/` (store: `store.tsx` — un solo contexto React).
  Rutas API en `app/api/`. Reglas de dinero en `lib/pos.ts`. Páginas públicas:
  `app/page.tsx` (landing), `app/ayuda`, `/terminos`, `/privacidad`, con
  cáscara compartida en `components/publico/Cascaron.tsx` + `app/publico.css`.

## Reglas de negocio críticas (no romper)

- **Inventario atómico** (`lib/inventory.ts`): `moveStock()` usa
  increment/decrement SQL; `InsufficientStockError` → rollback total → 422.
  Jamás leer-y-escribir stock en dos pasos.
- **Folios atómicos**: `Branch.saleSeq` y `Branch.quoteSeq` vía
  `UPDATE … RETURNING`. Nunca `COUNT(*)+1`.
- **Solo el efectivo entra al cajón**: el saldo esperado usa `cashPortion()`
  (lib/pos.ts). Tarjeta/transferencia/crédito no suman al esperado.
- **Abonos de crédito no son ventas** (la venta se contó al fiar); el abono en
  efectivo entra como ingreso de caja.
- **Variantes**: un producto `hasVariants` es agrupador — no se vende, no tiene
  stock, no aparece en búsqueda de cobro. Las variantes son productos normales
  con `parentId` + `variantLabel` ("M / Azul"); nombre = "Padre · Etiqueta".
  Renombrar/archivar el padre arrastra a las hijas.
- **Cotizaciones** (`Quote`): NO mueven inventario, ni caja, ni folio de venta.
  Se convierte pasando `quoteId` a POST /api/sales; el `updateMany` condicionado
  a `status: 'OPEN'` dentro de la transacción garantiza conversión única
  (segunda caja → 409 y rollback). "Vencida" se deriva de `validUntil`, no se
  guarda.
- **Devoluciones**: reembolso proporcional al valor de la línea, redondeado UNA
  vez (`Math.round(total × pedidoMil / totalMil)`); cantidades comparadas en
  gramos enteros (×1000) para evitar errores de coma flotante. El tope
  "vendido − devuelto" es del documento (no reembolsar más de lo cobrado), no
  del inventario.
- **Caja por usuario**: cada usuario abre/cierra SU turno (`openedById`).
  Compras de contado exigen caja abierta; transferencia y crédito no.
- **Decimales**: cantidades son Decimal(12,3) — siempre envolver en `Number()`.
  Productos por peso: `unitOfMeasure === 'kg'`, precio por kilo, teclado
  compartido `app/app/modals/TecladoPeso.tsx`.
- **Impresión**: todo botón de imprimir pasa por `app/app/Imprimir.tsx`
  (selector propio: térmica ESC/POS directa vía `printThermal()` o
  `window.print()`). Nada se imprime sin que el usuario lo pida. El navegador
  NO puede listar impresoras del sistema; solo térmicas USB/BT.
- **Refresco automático** (store.tsx): cada 30 s + al volver el foco/conexión
  recarga productos/caja/clientes. Solo lectura: jamás tocar carrito ni campos.
- **Cron**: `/api/cron/resumen-diario` (vercel.json, 02:00 UTC = 9 p.m.
  Colombia) protegido con `CRON_SECRET`; `/api/cron` está exceptuado del
  middleware porque llega sin sesión.

## Verificación local (obligatoria antes de cada PR)

```bash
service postgresql start   # se detiene entre sesiones
export DATABASE_URL="postgresql://ventory:ventory_dev@localhost:5432/ventory_dev"
export DIRECT_URL="$DATABASE_URL"     # en statements separados
npx tsc --noEmit && npm run build && npm test   # 77 pruebas Jest
# Standalone (npm start NO funciona con output:standalone):
cp -r .next/static .next/standalone/.next/ && rm -rf .next/standalone/public && cp -r public .next/standalone/
cd .next/standalone && DATABASE_URL=... DIRECT_URL=... NEXTAUTH_SECRET=dev-secret-ventory-local \
  NEXTAUTH_URL=http://localhost:3100 SUPER_ADMIN_EMAIL=mar_u_79@hotmail.com PORT=3100 node server.js
# puerto ocupado: fuser -k 3100/tcp
```

- **QA de sistema**: `qa/` — 425 pruebas end-to-end (ver `qa/README.md`).
  qa-13 necesita `qa/wompi-falso.js` (puerto 2526) y el servidor con llaves
  Wompi de prueba (`WOMPI_*` + `WOMPI_API_BASE`/`WOMPI_CHECKOUT_BASE`
  apuntando al falso). qa-14 necesita `qa/mercadopago-falso.js` (2527) y el
  servidor con `MP_ACCESS_TOKEN=TEST-…` + `MP_API_BASE` SIN llaves Wompi.
  Requieren Playwright: `NODE_PATH=<scratchpad>/node_modules` con
  `npm install playwright` hecho en el scratchpad; Chromium en
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (qa-lib ya lo apunta).
  qa-8 necesita SMTP falso (`qa/smtp-falso.js`) + `SMTP_HOST=127.0.0.1
  SMTP_PORT=2525 SMTP_NO_AUTH=true GMAIL_USER=x GMAIL_APP_PASSWORD=x` y
  `VENTORY_BUZON=<archivo>`; con el mailer activo, el registro pide verificar
  correo y qa-lib saca el enlace del buzón solo.
- Cuenta semilla local: `mar_u_79@hotmail.com` / `VentoryBB2026` (negocio
  "Bora y Bora"). Toda batería QA nueva sigue el patrón de `qa/qa-lib.js`.
- **El contenedor a veces borra node_modules y el cluster de Postgres**. Si
  `psql` falla con "password authentication failed": recrear rol/BDs
  (`CREATE ROLE ventory LOGIN PASSWORD 'ventory_dev' CREATEDB;` + BDs
  `ventory_dev` y `ventory_shadow` como postgres), `migrate deploy`, y la
  cuenta semilla vía POST /api/auth/register + enlace del buzón falso.
  `npm ci` en el repo y `npm install playwright` en el scratchpad.
- **Migraciones**: `prisma migrate dev` no funciona (no interactivo). Usar:
  `npx prisma migrate diff --from-migrations prisma/migrations
  --to-schema-datamodel prisma/schema.prisma --shadow-database-url
  postgresql://ventory:ventory_dev@localhost:5432/ventory_shadow --script`
  a una carpeta timestampeada en `prisma/migrations/`, luego `migrate deploy`.
  Comentarios en schema.prisma con `///` (no `/** */`).

## Flujo de trabajo git

Rama de trabajo: `claude/ventory-pos-backend-1pzp7w`. Los PRs se mergean por
squash a `master` y Vercel despliega solo. Si el PR da conflicto: rebase con
`git checkout -B rebase-tmp origin/master && git cherry-pick <commits>` y
force-with-lease. Mensajes de commit en español, explicando el porqué.

## Decisiones de producto ya tomadas (no re-preguntar)

- Plan único **$ 59.900/mes**, prueba gratis 15 días sin tarjeta. Soporte SOLO
  por correo: `ventorypos@gmail.com`.
- **Pasarela Wompi construida y APAGADA por defecto** (`lib/wompi.ts`): sin
  las 4 variables `WOMPI_*` en Vercel todo sigue con activación manual vía
  super admin. Cada pago aprobado suma 30 días (`Business.paidUntil`;
  `paidUntil` null en ACTIVE = activación manual sin vencimiento). Webhook
  `/api/wompi/eventos` (exento de middleware, protegido por firma); respaldo
  GET `/api/plan/checkout?ref=`.
- **Mercado Pago como pasarela INTERINA** (`lib/mercadopago.ts`): Samuel la
  eligió mientras completa el registro de Wompi (MP acepta persona natural
  solo con cédula; él ya tiene RUT creado en la DIAN, le falta recuperar el
  acceso). Se enciende con una sola variable `MP_ACCESS_TOKEN` (TEST-… o
  APP_USR-…). **Prioridad: si las llaves de Wompi están, Wompi manda**
  (`lib/pasarela.ts`). Su webhook `/api/mercadopago/eventos` no confía en el
  cuerpo: consulta el pago a la API de MP con nuestro token y exige monto
  exacto. `PlanPayment.gateway` distingue la pasarela de cada pago.
- Sin facturación DIAN todavía (requiere RUT + habilitación del usuario);
  descartados: promociones/combos, reportes por cajero, gastos fuera de caja.
- Cotizaciones sin apartar inventario y sin abonos (versión simple, a
  propósito). Cotizar de más es legítimo (encargos); cobrar exige stock.
- Cerrar caja exigirá siempre internet (no llevar al modo offline).
- Emojis prohibidos en la UI; usar `components/Icono.tsx`.
- El modelo de caja actual (por usuario) le sirve al dueño; solo cambiarlo si
  pide cobrar entre varios sobre el mismo cajón.
- **Tres roles de empleado** (cada uno con su cuenta propia; Ajustes →
  Usuarios; hay ingreso rápido por PIN en `/pin-login`): Cajero (vende, caja,
  clientes, cotizaciones), Encargado/SUPERVISOR (además compras, proveedores,
  inventario, movimientos y reportes) y Administrador (todo). `isFullAdmin`
  (solo ADMIN) protege usuarios, ajustes del negocio, plan/pagos y
  exportaciones; `isAdmin` (ADMIN+SUPERVISOR) protege lo operativo.

## Seguridad / secretos

- NUNCA pedir ni aceptar contraseñas/tokens en el chat. Los secretos van
  directo a Vercel (el usuario los pone). Variables en producción:
  `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
  `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SUPER_ADMIN_EMAIL`, `CRON_SECRET`;
  opcionales (pasarela): `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`,
  `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`; o bien `MP_ACCESS_TOKEN`
  (Mercado Pago, la interina); opcionales (correo por SMTP en vez de Gmail,
  recomendado Brevo por entregabilidad): `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (remitente visible, verificado en
  Brevo). Gmail personal demora y manda a spam los envíos a terceros.
- Pendiente confirmar por el usuario: rotación de la contraseña de Neon (se
  expuso una vieja en chat) y que `CRON_SECRET` esté puesto en Vercel (sin él
  no sale el resumen diario).

## Estado (agosto 2026) y pendientes

Hecho y en producción (PRs #12–#38): POS completo (venta, cobro combinado,
crédito, devoluciones parciales incl. por peso, esperas, anulaciones), compras
y proveedores con abonos, caja con cierre diario e informe, reportes con
utilidad y rangos, clientes, variantes, cotizaciones, importador CSV, exportar
CSV/backup, código de barras (USB + cámara), impresión térmica con selector
propio, multi-sucursal, usuarios/roles/PIN, verificación de correo, plan
comercial + super admin (`/admin`), PWA offline ampliada (ventas contado y
crédito, compras y crear productos sin red — cola única en IndexedDB
`operaciones-pendientes`, envío FIFO con remapeo de ids provisionales
`offline-*` de productos creados sin conexión; ver `app/app/offline.ts`),
notificaciones automáticas por correo, landing + centro de ayuda + guía de
primeros pasos, pantalla completa para táctiles, refresco automático
multi-dispositivo.

Pendientes conocidos:
1. **Pasar Mercado Pago a producción**: el ciclo completo ya quedó PROBADO
   en producción con credenciales de prueba (8/ago/2026: pago simulado con
   cuenta compradora de prueba → activación automática). Nota: en el esquema
   nuevo de MP las credenciales de prueba también empiezan por APP_USR- (no
   TEST-), y el pago de prueba exige comprador de prueba logueado (las
   opciones "sin cuenta" dan "una de las partes es de prueba"). Falta solo:
   reemplazar el valor de `MP_ACCESS_TOKEN` en Vercel por el token de
   Credenciales de PRODUCCIÓN + Redeploy, cuando Samuel decida cobrar.
   El webhook quedó registrado en MP (evento "Pagos legacy") hacia
   `https://ventory-ten.vercel.app/api/mercadopago/eventos`.
2. **Migrar a Wompi cuando recupere el RUT** (ya existe en la DIAN, le falta
   recuperar el acceso en muisca.dian.gov.co): pone las 4 llaves `WOMPI_*` y
   Wompi toma prioridad automáticamente, sin tocar código.
3. **Nivel 4 restante**: facturación electrónica DIAN (requiere RUT,
   certificado y habilitación DIAN del usuario — no es solo código).
4. Ofrecido sin decidir: devolución sin factura de referencia (nota crédito
   suelta); modelo de caja compartida por sucursal.
