import { getToken } from 'next-auth/jwt'
import { NextRequest } from 'next/server'
import { UserRole } from '@prisma/client'

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  businessId: string
  businessName: string
  businessSlug: string
}

export async function getCurrentUser(req: NextRequest): Promise<SessionUser | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || !token.id) return null
  return {
    id: token.id as string,
    email: token.email as string,
    role: token.role as UserRole,
    businessId: token.businessId as string,
    businessName: token.businessName as string,
    businessSlug: token.businessSlug as string,
  }
}
