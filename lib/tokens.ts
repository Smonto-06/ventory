import crypto from 'crypto'

// Los tokens de verificación de correo y de restablecimiento de contraseña
// se envían en texto plano por el enlace del correo, pero en la base de
// datos solo se guarda este hash — si la BD se filtra (ya pasó una vez con
// una contraseña de Neon, ver CLAUDE.md), un dump no entrega tokens
// directamente usables para tomar cuentas.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
