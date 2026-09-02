// Envío de correos del sistema (nodemailer).
//
// Dos maneras de configurarlo:
//  - Gmail (la original): GMAIL_USER + GMAIL_APP_PASSWORD. Gmail no está
//    hecho para correo transaccional: demora y manda a spam los envíos a
//    terceros — sirve para arrancar, no para operar.
//  - Cualquier SMTP (recomendado Brevo): SMTP_HOST + SMTP_PORT + SMTP_USER +
//    SMTP_PASS. El remitente visible sale de MAIL_FROM (o de GMAIL_USER si
//    sigue puesta) — en Brevo debe ser un remitente verificado en su panel.
//
// El SMTP falso de las pruebas usa SMTP_HOST + SMTP_NO_AUTH=true (sin TLS).
// El correo de destino de soporte puede sobreescribirse con CONTACT_EMAIL.

import nodemailer from 'nodemailer'

// El resumen diario interpola nombres controlados por el usuario (nombre del
// negocio, nombre de producto — este último editable incluso por rol
// SUPERVISOR) directo en un template HTML. Sin escapar, un nombre con
// "<a href=...>" rompe la maquetación del correo o inserta un enlace con
// apariencia legítima dentro de un correo de confianza.
function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function mailerConfigured(): boolean {
  const gmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  const smtp =
    !!process.env.SMTP_HOST &&
    (process.env.SMTP_NO_AUTH === 'true' || !!(process.env.SMTP_USER && process.env.SMTP_PASS) || gmail)
  return gmail || smtp
}

/** Dirección visible del remitente (en Brevo debe estar verificada allá) */
function remitente(): string {
  return process.env.MAIL_FROM ?? process.env.GMAIL_USER ?? process.env.SMTP_USER ?? ''
}

function transport() {
  if (process.env.SMTP_HOST) {
    const sinAuth = process.env.SMTP_NO_AUTH === 'true'
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      // Solo el SMTP falso de QA habla sin cifrar; los reales (Brevo, etc.)
      // negocian STARTTLS solos en el puerto 587
      ignoreTLS: sinAuth,
      auth: sinAuth
        ? undefined
        : {
            user: process.env.SMTP_USER ?? process.env.GMAIL_USER,
            pass: process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD,
          },
    })
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
}

export interface ContactMessage {
  type: string
  subject: string
  message: string
  fromName: string
  fromEmail: string
  businessName: string
}

/**
 * Mensaje de "Contáctanos": se envía DESDE la cuenta del sistema hacia la
 * bandeja de soporte, con Reply-To del usuario que escribe (responderle a él
 * es un clic). No se puede enviar "desde" el correo del usuario: los
 * proveedores lo bloquean por anti-suplantación.
 */
/** Enlace de recuperación de contraseña (token de 1 hora) */
export async function sendPasswordResetEmail(to: string, name: string, link: string): Promise<void> {
  await transport().sendMail({
    from: `"Ventory" <${remitente()}>`,
    to,
    subject: 'Restablecer tu contraseña de Ventory',
    text:
      `Hola${name ? ` ${name}` : ''},\n\n` +
      `Recibimos una solicitud para restablecer tu contraseña de Ventory.\n` +
      `Abre este enlace para elegir una nueva (vence en 1 hora):\n\n${link}\n\n` +
      `Si no fuiste tú, ignora este correo — tu contraseña actual sigue siendo válida.\n\n— Ventory`,
  })
}

/** Enlace de verificación de correo al crear la cuenta */
export async function sendVerificationEmail(to: string, name: string, link: string): Promise<void> {
  await transport().sendMail({
    from: `"Ventory" <${remitente()}>`,
    to,
    subject: 'Confirma tu correo — Ventory',
    text:
      `Hola${name ? ` ${name}` : ''},\n\n` +
      `¡Bienvenido a Ventory! Confirma tu correo abriendo este enlace:\n\n${link}\n\n` +
      `Después de confirmar podrás iniciar sesión y empezar tu prueba gratis de 15 días.\n\n— Ventory`,
  })
}

export async function sendContactEmail(msg: ContactMessage): Promise<void> {
  const to = process.env.CONTACT_EMAIL || remitente()
  await transport().sendMail({
    from: `"Ventory · ${msg.businessName}" <${remitente()}>`,
    to,
    replyTo: `"${msg.fromName}" <${msg.fromEmail}>`,
    subject: `[${msg.type}] ${msg.subject}`,
    text: `${msg.message}\n\n—\nEnviado desde Ventory\nNegocio: ${msg.businessName}\nUsuario: ${msg.fromName} <${msg.fromEmail}>`,
  })
}

// ─── Resumen diario ───────────────────────────────────────────────────────
// Correo que recibe el dueño al cierre del día. Se manda en HTML y en texto
// plano, porque muchos lo van a leer desde el celular con la vista previa.

import type { ResumenDiario } from './resumen-diario'

const pesos = (n: number, moneda = '$') =>
  `${moneda} ${Math.round(n).toLocaleString('es-CO')}`

function fila(etiqueta: string, valor: string, destacar = false): string {
  return `<tr>
    <td style="padding:7px 0;color:#64748b;font-size:14px">${etiqueta}</td>
    <td style="padding:7px 0;text-align:right;font-size:14px;font-weight:${destacar ? 700 : 600};color:#0f172a">${valor}</td>
  </tr>`
}

export function textoResumen(r: ResumenDiario): string {
  const m = r.moneda === 'COP' ? '$' : r.moneda
  const lineas = [
    `${r.negocio} — resumen del ${r.fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}`,
    '',
    `Ventas: ${pesos(r.ventas.total, m)} en ${r.ventas.transacciones} transacciones`,
    `  Efectivo ${pesos(r.porMetodo.efectivo, m)} · Tarjeta ${pesos(r.porMetodo.tarjeta, m)} · Transferencia ${pesos(r.porMetodo.transferencia, m)} · Crédito ${pesos(r.porMetodo.credito, m)}`,
    `Utilidad neta: ${pesos(r.utilidad.neta, m)}`,
    '',
  ]
  if (r.cierres.length) {
    for (const c of r.cierres) {
      const d = c.diferencia
      lineas.push(
        `Cierre de caja: contado ${pesos(c.contado, m)} · esperado ${pesos(c.esperado, m)} · ${
          d === 0 ? 'sin diferencia' : d > 0 ? `sobrante ${pesos(d, m)}` : `faltante ${pesos(-d, m)}`
        }`,
      )
    }
  } else if (r.caja.turnoAbierto) {
    lineas.push(`ATENCIÓN: la caja quedó abierta. Saldo esperado ${pesos(r.caja.esperado, m)}.`)
  }
  if (r.compras.cantidad) lineas.push(`Compras: ${pesos(r.compras.total, m)} en ${r.compras.cantidad}`)
  if (r.credito.otorgado || r.credito.abonado)
    lineas.push(`Crédito otorgado ${pesos(r.credito.otorgado, m)} · abonos recibidos ${pesos(r.credito.abonado, m)}`)
  if (r.devoluciones.cantidad)
    lineas.push(`Devoluciones: ${pesos(r.devoluciones.total, m)} en ${r.devoluciones.cantidad}`)
  if (r.agotados.length) {
    lineas.push('', `Productos por reponer (${r.agotados.length}):`)
    for (const a of r.agotados.slice(0, 15))
      lineas.push(`  - ${a.nombre}: ${a.stock <= 0 ? 'AGOTADO' : `quedan ${a.stock}${a.unidad === 'kg' ? ' kg' : ''}`}`)
    if (r.agotados.length > 15) lineas.push(`  …y ${r.agotados.length - 15} más`)
  }
  return lineas.join('\n')
}

export async function sendDailySummaryEmail(to: string, r: ResumenDiario): Promise<void> {
  const m = r.moneda === 'COP' ? '$' : r.moneda
  const fecha = r.fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  const cierres = r.cierres.length
    ? r.cierres
        .map((c) => {
          const d = c.diferencia
          const color = d === 0 ? '#10b981' : '#c9433b'
          const texto = d === 0 ? 'Sin diferencia' : d > 0 ? `Sobrante ${pesos(d, m)}` : `Faltante ${pesos(-d, m)}`
          return `<tr><td style="padding:7px 0;color:#64748b;font-size:14px">Cierre · contado ${pesos(c.contado, m)}</td>
            <td style="padding:7px 0;text-align:right;font-size:14px;font-weight:700;color:${color}">${texto}</td></tr>`
        })
        .join('')
    : r.caja.turnoAbierto
      ? `<tr><td colspan="2" style="padding:10px;background:#fdf4e5;border-radius:8px;color:#8a6b2e;font-size:13.5px">
          La caja quedó <b>abierta</b>. Saldo esperado: ${pesos(r.caja.esperado, m)}.</td></tr>`
      : ''

  const agotados = r.agotados.length
    ? `<div style="margin-top:22px;padding:16px;background:#fdecec;border-radius:10px">
        <div style="font-weight:700;color:#c9433b;font-size:14px;margin-bottom:8px">
          ${r.agotados.length} producto${r.agotados.length === 1 ? '' : 's'} por reponer
        </div>
        ${r.agotados
          .slice(0, 15)
          .map(
            (a) =>
              `<div style="font-size:13.5px;color:#0f172a;padding:3px 0">${escapeHtml(a.nombre)} —
               <b>${a.stock <= 0 ? 'agotado' : `quedan ${a.stock}${a.unidad === 'kg' ? ' kg' : ''}`}</b></div>`,
          )
          .join('')}
        ${r.agotados.length > 15 ? `<div style="font-size:13px;color:#64748b;margin-top:6px">y ${r.agotados.length - 15} más</div>` : ''}
      </div>`
    : ''

  const top = r.topProductos.length
    ? `<div style="margin-top:22px">
        <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:8px">Más vendidos</div>
        ${r.topProductos
          .map(
            (p) =>
              `<div style="display:flex;justify-content:space-between;font-size:13.5px;padding:4px 0;color:#0f172a">
                <span>${escapeHtml(p.nombre)} · ${p.cantidad}</span><span style="font-weight:600">${pesos(p.total, m)}</span></div>`,
          )
          .join('')}
      </div>`
    : ''

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f6f8fb;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
      <div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#4f46e5">Ventory</div>
      <h1 style="margin:8px 0 2px;font-size:22px;color:#0f172a">${escapeHtml(r.negocio)}</h1>
      <div style="color:#64748b;font-size:14px;text-transform:capitalize">${fecha}</div>

      <div style="margin:22px 0;padding:20px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:14px;color:#fff">
        <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.8px;font-weight:700">Ventas del día</div>
        <div style="font-size:30px;font-weight:700;margin-top:4px">${pesos(r.ventas.total, m)}</div>
        <div style="font-size:13.5px;opacity:.9">${r.ventas.transacciones} ${r.ventas.transacciones === 1 ? 'venta' : 'ventas'} · promedio ${pesos(r.ventas.promedio, m)}</div>
      </div>

      <table style="width:100%;border-collapse:collapse">
        ${fila('Efectivo', pesos(r.porMetodo.efectivo, m))}
        ${fila('Tarjeta', pesos(r.porMetodo.tarjeta, m))}
        ${fila('Transferencia', pesos(r.porMetodo.transferencia, m))}
        ${r.porMetodo.credito ? fila('Crédito (fiado)', pesos(r.porMetodo.credito, m)) : ''}
        <tr><td colspan="2" style="border-top:1px solid #eef2f7;padding-top:6px"></td></tr>
        ${fila('Costo de lo vendido', `− ${pesos(r.utilidad.costo, m)}`)}
        ${r.utilidad.gastos ? fila('Gastos de caja', `− ${pesos(r.utilidad.gastos, m)}`) : ''}
        ${fila('Utilidad neta', pesos(r.utilidad.neta, m), true)}
        ${cierres ? `<tr><td colspan="2" style="border-top:1px solid #eef2f7;padding-top:6px"></td></tr>${cierres}` : ''}
        ${r.compras.cantidad ? fila(`Compras (${r.compras.cantidad})`, pesos(r.compras.total, m)) : ''}
        ${r.credito.abonado ? fila('Abonos recibidos', pesos(r.credito.abonado, m)) : ''}
        ${r.devoluciones.cantidad ? fila(`Devoluciones (${r.devoluciones.cantidad})`, pesos(r.devoluciones.total, m)) : ''}
      </table>

      ${top}
      ${agotados}

      <div style="margin-top:26px;padding-top:18px;border-top:1px solid #eef2f7;font-size:12.5px;color:#94a3b8;line-height:1.6">
        Este resumen se envía todos los días al cierre. Puedes desactivarlo en
        <b>Ajustes → Notificaciones</b> dentro de Ventory.
      </div>
    </div>
  </div>`

  await transport().sendMail({
    from: `"Ventory" <${remitente()}>`,
    to,
    subject: `${r.negocio} · ventas del día: ${pesos(r.ventas.total, m)}`,
    text: textoResumen(r),
    html,
  })
}
