# Batería de pruebas de sistema (QA)

Pruebas de extremo a extremo contra un servidor real, complementarias a
`npm test` (que cubre las reglas de negocio con Jest).

## Qué cubre — 133 pruebas

| Archivo | Área | Pruebas |
|---|---|---|
| `qa-1-seguridad.js` | Aislamiento entre negocios, permisos por rol, acceso sin sesión | 22 |
| `qa-2-operacion.js` | Ventas (todos los métodos y bordes), caja, devoluciones, anulaciones, compras, crédito, cierre | 37 |
| `qa-3-datos.js` | Productos, importación CSV, inventario, esperas, reportes, exportaciones, autenticación | 33 |
| `qa-4-plan-ui.js` | Catálogos, ajustes, IVA, plan comercial, super admin y recorrido de la interfaz | 29 |
| `qa-5-movil-offline.js` | Uso en celular y ciclo offline completo (vender sin red → sincronizar) | 12 |

## Cómo ejecutarlas

Con la aplicación corriendo en `http://localhost:3100` y una cuenta de
administrador de prueba:

    node qa/qa-1-seguridad.js
    node qa/qa-2-operacion.js
    # …

Las pruebas 4 y 5 usan la cuenta semilla y requieren `SUPER_ADMIN_EMAIL`
configurado en el servidor para la sección de super administrador.

Cada archivo imprime ✓/✗ por prueba y termina con código distinto de cero
si algo falla, de modo que sirve en integración continua.
