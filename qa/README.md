# Batería de pruebas de sistema (QA)

Pruebas de extremo a extremo contra un servidor real, complementarias a
`npm test` (que cubre las reglas de negocio con Jest).

## Qué cubre — 407 pruebas

| Archivo | Área | Pruebas |
|---|---|---|
| `qa-1-seguridad.js` | Aislamiento entre negocios, permisos por rol, acceso sin sesión | 22 |
| `qa-2-operacion.js` | Ventas (todos los métodos y bordes), caja, devoluciones, anulaciones, compras, crédito, cierre | 37 |
| `qa-3-datos.js` | Productos, importación CSV, inventario, esperas, reportes, exportaciones, autenticación | 33 |
| `qa-4-plan-ui.js` | Catálogos, ajustes, IVA, plan comercial, super admin, recorrido de la interfaz y pantalla completa | 34 |
| `qa-5-movil-offline.js` | Uso en celular y ciclo offline completo (vender sin red → sincronizar) | 12 |
| `qa-6-landing-ayuda-guia.js` | Página comercial, centro de ayuda y guía de primeros pasos | 33 |
| `qa-7-variantes.js` | Variantes de producto: creación, venta, stock por variante, conversión y archivado | 34 |
| `qa-8-notificaciones.js` | Resumen diario por correo, aviso de reposición, cron, envío real y reenvío de verificación | 39 |
| `qa-9-cotizaciones.js` | Cotizaciones (sin tocar inventario) y devolución parcial por peso | 52 |
| `qa-10-refresco.js` | Refresco automático entre dispositivos sin dañar el trabajo en curso | 10 |
| `qa-11-imprimir.js` | Ventana de impresión propia: térmica directa o impresora del computador | 21 |
| `qa-12-offline-ampliado.js` | Offline ampliado: compras, crédito y crear productos sin red, cola en orden con remapeo de ids | 24 |
| `qa-13-pagos.js` | Pasarela Wompi: checkout firmado, webhook con firma, activación automática sin duplicar, respaldo sin webhook | 31 |
| `qa-14-pagos-mp.js` | Pasarela Mercado Pago (interina): webhook verificado contra su API, monto exacto, idempotencia, respaldo por referencia | 25 |

## Cómo ejecutarlas

Con la aplicación corriendo en `http://localhost:3100` y una cuenta de
administrador de prueba:

    node qa/qa-1-seguridad.js
    node qa/qa-2-operacion.js
    # …

Las pruebas 4 y 5 usan la cuenta semilla y requieren `SUPER_ADMIN_EMAIL`
configurado en el servidor para la sección de super administrador.

La prueba 8 verifica el envío real de correo. Para eso se levanta un
servidor SMTP de mentira que escribe los mensajes a un archivo, se arranca
la aplicación apuntando a él y se le indica dónde está el buzón:

    node smtp-falso.js /tmp/buzon.jsonl &
    SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_NO_AUTH=true \
      GMAIL_USER=ventory@prueba.local GMAIL_APP_PASSWORD=x \
      CRON_SECRET=secreto-local node server.js
    VENTORY_BUZON=/tmp/buzon.jsonl CRON_SECRET_PRUEBA=secreto-local \
      node qa/qa-8-notificaciones.js

Sin esas variables la prueba corre igual, omitiendo la parte del envío.

La prueba 13 necesita el Wompi de mentira y el servidor con las llaves de
prueba de la pasarela:

    node qa/wompi-falso.js &
    WOMPI_PUBLIC_KEY=pub_test_qa WOMPI_PRIVATE_KEY=prv_test_qa \
      WOMPI_INTEGRITY_SECRET=integridad-qa WOMPI_EVENTS_SECRET=eventos-qa \
      WOMPI_API_BASE=http://127.0.0.1:2526 \
      WOMPI_CHECKOUT_BASE=http://127.0.0.1:2526/p/ node server.js
    node qa/qa-13-pagos.js

La 14 igual, pero con Mercado Pago de mentira y el servidor SIN llaves de
Wompi (si están, Wompi tiene prioridad y la prueba no aplica):

    node qa/mercadopago-falso.js &
    MP_ACCESS_TOKEN=TEST-qa MP_API_BASE=http://127.0.0.1:2527 node server.js
    node qa/qa-14-pagos-mp.js

Cada archivo imprime ✓/✗ por prueba y termina con código distinto de cero
si algo falla, de modo que sirve en integración continua.
