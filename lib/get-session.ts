import { getToken } from 'next-auth/jwt'
import { NextRequest } from 'next/server'
import { UserRole } from '@prisma/client'
import { db } from './db'

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  businessId: string
  businessName: string
  businessSlug: string
  branchId?: string
}

export async function getCurrentUser(req: NextRequest): Promise<SessionUser | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || !token.id) return null

  // Igual que en el callback session() de NextAuth: un usuario desactivado a
  // mitad de turno pierde acceso de una, no solo en su próximo login — si no,
  // "Desactivar" (Ajustes → Usuarios) no corta nada mientras la cookie viva.
  // Se refrescan también role/branchId desde la BD: quedaban "congelados" en
  // el JWT firmado al iniciar sesión, así que degradar a un ADMIN a CAJERO
  // (o reasignarlo de sucursal) no le quitaba esos permisos en las rutas de
  // API hasta que la cookie de 8h expirara por su cuenta.
  const activo = await db.user.findUnique({
    where: { id: token.id as string },
    select: { isActive: true, role: true, branchId: true },
  })
  if (!activo?.isActive) return null

  return {
    id: token.id as string,
    email: token.email as string,
    role: activo.role,
    businessId: token.businessId as string,
    businessName: token.businessName as string,
    businessSlug: token.businessSlug as string,
    branchId: activo.branchId ?? undefined,
  }
}
