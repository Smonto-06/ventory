# Ventory POS — Handoff para Backend (Claude Code)

## Contexto
`Ventory POS - Frontend completo.html` es un prototipo funcional completo del frontend de un sistema POS para retail (Colombia, precios COP con IVA incluido). **Toda la lógica de negocio ya está implementada en JavaScript dentro del prototipo** (clase `Component`, en el `<script data-dc-script>` del archivo fuente `Ventory POS.dc.html`). El trabajo del backend es **persistir y servir esas mismas reglas**, no inventar nuevas. El prototipo es la fuente de verdad para UI, flujos y cálculos.

Estado actual: todo vive en memoria del navegador (se pierde al recargar). Login, sucursales y roles son visuales.

## Objetivo del backend
1. Base de datos persistente + API que replique las operaciones del prototipo.
2. Autenticación real: **solo el dueño del sistema crea cuentas** (no hay registro público). Login con email/contraseña + selección de sucursal y rol.
3. Reconstruir el frontend como app real (React/Next o similar) usando el prototipo como especificación visual y funcional 1:1 — mismos colores (acento teal #109887, fondos menta), tipografía Public Sans, layouts y microcopys.

## Modelos de datos (implícitos en el prototipo)
- **Usuario**: email, hash, rol (`admin` | `cajero`), sucursal(es).
- **Sucursal**: nombre. El stock y la caja deberían separarse por sucursal (el prototipo lo simula con una sola).
- **Producto**: nombre, sku, **barcode** (separado del sku), categoría, proveedor, precio venta, costo, stock, stock mínimo, foto, archivado (soft delete).
- **Categoría**: nombre; solo eliminable sin productos asociados.
- **Cliente**: nombre, teléfono, documento, **saldo de crédito**.
- **Proveedor**: nombre, teléfono.
- **Venta**: consecutivo `F-XXXXXX`, timestamp, cajero, sucursal, cliente opcional, items [{producto, qty, precio, dscPct por artículo, retQty devueltos, costo}], descuento total ($ o %), total, método(s) de pago (combinables: Efectivo+Tarjeta+Transferencia con montos por método, o Crédito exclusivo), estado (activa/anulada), turno.
- **Compra**: proveedor, timestamp, items [{producto, qty, costo unitario, costo total, precio venta nuevo}], valor, abono, método (`contado`/`transferencia`/`credito`), saldo pendiente = valor − abono.
- **Movimiento de caja**: tipo (`ingreso`/`gasto`), descripción, comentario, monto, timestamp, turno. Descripciones: ingresos = Base de caja, Abono de cliente, Otro; gastos = Pago a proveedor, Servicios públicos, Domicilios, Devolución, Anulación de venta, Otro.
- **Turno (cierre de caja)**: apertura, ventas, ingresos, gastos, saldo esperado, total contado, diferencia, fecha, cajero.
- **Espera**: ventas en espera (varias, con cliente opcional) y compras en espera; la compra "en curso" es una sola por sesión.
- **Ajuste**: settings (IVA % incluido, sucursal activa).

## Reglas de negocio críticas (replicar exactamente)
1. **Cobro combinado**: métodos Efectivo/Tarjeta/Transferencia se combinan; cada no-efectivo lleva monto, el restante se cobra en efectivo (teclado de billetes, cambio = recibido − restante). Crédito es exclusivo y suma el total al saldo del cliente.
2. **Saldo esperado de caja** = apertura + ventas del turno + ingresos − gastos. Solo ventas del turno actual (no anuladas) cuentan.
3. **Venta a crédito** → `cliente.saldo += total`. **Abono de cliente** → descuenta saldo; si es en efectivo, genera movimiento ingreso "Abono de cliente"; emite recibo.
4. **Compra**: actualiza por producto: `stock += qty`, `costo = costo unitario nuevo`, `precio = venta nueva`, proveedor. Contado → pagada completa + gasto de caja "Pago a proveedor". Transferencia → pagada sin afectar caja física. Crédito → saldo pendiente a nombre del proveedor (abono inicial opcional). **Pago a proveedor** posterior descuenta el saldo (efectivo → gasto de caja). Campos de la línea enlazados: qty×unitario=total; % ganancia ↔ precio de venta.
5. **Devolución** (de cualquier venta histórica): por artículo con tope `qty − retQty`; regresa stock; reembolso = gasto de caja "Devolución". **Cambio**: igual pero sin gasto — el valor devuelto se aplica como descuento ($) en una nueva venta.
6. **Anulación de venta**: regresa stock restante, gasto de caja por lo no devuelto, marca anulada (excluida de totales y reportes; visible en historial).
7. **Cierre de turno**: registra el turno, pide apertura del siguiente (prefill = contado), limpia ventas/movimientos/conteo del turno; el historial de ventas se conserva (marcadas de turnos anteriores).
8. **IVA**: incluido en el precio; desglose informativo = total × pct / (100 + pct).
9. **Descuentos**: total en $ o % (excluyente), y por artículo en % — el total nunca baja de 0.
10. **Roles**: cajero no ve Compras, Proveedores, Movimientos, Reportes, Ajustes, ni costos de productos.
11. **Stock mínimo**: alerta visual cuando stock ≤ mínimo. **Archivar** producto = soft delete. Categorías eliminables solo si están vacías.
12. **Reportes**: por fecha calendario — total, transacciones, venta promedio, arts/venta, ventas por hora, por método, top 5 productos, utilidad (ventas − costo de lo vendido, margen %, − gastos = neta).

## API sugerida (REST)
`POST /auth/login` · CRUD `/products`, `/categories`, `/clients`, `/suppliers` · `POST /sales`, `POST /sales/:id/return`, `POST /sales/:id/void` · `GET /sales?from&to&q` · `POST /purchases`, `POST /purchases/:id/payment` · `POST /clients/:id/payment` · `POST /cash-movements` · `POST /shifts/close`, `GET /shifts` · `GET /reports/daily?date` · `POST /inventory/adjust`, `POST /inventory/transfer` · `PUT /settings`. Esperas pueden ser tablas simples o estado local sincronizado.

## Indicaciones de implementación
- Consecutivo de facturas atómico en DB. Dinero en enteros (COP sin decimales).
- Todas las operaciones que tocan stock/caja/saldos deben ser transaccionales.
- Auditoría: guardar usuario y timestamp en ventas, anulaciones, devoluciones, ajustes y cierres.
- Fuera de alcance por ahora (fase 2): facturación DIAN, impresora térmica nativa (el frontend ya trae vista de ticket 80mm imprimible), modo offline, multi-sucursal real de datos.
