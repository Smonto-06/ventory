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
