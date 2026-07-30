// Envío de correos del sistema vía Gmail (nodemailer).
// Requiere GMAIL_USER y GMAIL_APP_PASSWORD (contraseña de aplicación de Google).
// El correo de destino de soporte puede sobreescribirse con CONTACT_EMAIL.

import nodemailer from 'nodemailer'

export function mailerConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

function transport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
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
    from: `"Ventory" <${process.env.GMAIL_USER}>`,
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
    from: `"Ventory" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Confirma tu correo — Ventory',
    text:
      `Hola${name ? ` ${name}` : ''},\n\n` +
      `¡Bienvenido a Ventory! Confirma tu correo abriendo este enlace:\n\n${link}\n\n` +
      `Después de confirmar podrás iniciar sesión y empezar tu prueba gratis de 15 días.\n\n— Ventory`,
  })
}

export async function sendContactEmail(msg: ContactMessage): Promise<void> {
  const to = process.env.CONTACT_EMAIL || process.env.GMAIL_USER!
  await transport().sendMail({
    from: `"Ventory · ${msg.businessName}" <${process.env.GMAIL_USER}>`,
    to,
    replyTo: `"${msg.fromName}" <${msg.fromEmail}>`,
    subject: `[${msg.type}] ${msg.subject}`,
    text: `${msg.message}\n\n—\nEnviado desde Ventory\nNegocio: ${msg.businessName}\nUsuario: ${msg.fromName} <${msg.fromEmail}>`,
  })
}
