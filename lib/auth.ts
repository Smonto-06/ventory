import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { db } from './db'

const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const MAX_FAILED_ATTEMPTS = 5

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours (one work shift)
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email y contraseña',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email y contraseña son requeridos')
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { business: true },
        })

        if (!user) {
          throw new Error('Credenciales inválidas')
        }

        // Check if account is locked
        if (user.lockedAt) {
          const lockExpires = new Date(user.lockedAt.getTime() + LOCK_DURATION_MS)
          if (new Date() < lockExpires) {
            const minutesLeft = Math.ceil((lockExpires.getTime() - Date.now()) / 60000)
            throw new Error(`Cuenta bloqueada. Intenta en ${minutesLeft} minutos.`)
          } else {
            // Lock expired — reset
            await db.user.update({
              where: { id: user.id },
              data: { failedAttempts: 0, lockedAt: null },
            })
          }
        }

        const passwordValid = await bcrypt.compare(credentials.password, user.password)

        if (!passwordValid) {
          const newAttempts = user.failedAttempts + 1
          const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS

          await db.user.update({
            where: { id: user.id },
            data: {
              failedAttempts: newAttempts,
              lockedAt: shouldLock ? new Date() : null,
            },
          })

          if (shouldLock) {
            throw new Error('Cuenta bloqueada por 15 minutos tras 5 intentos fallidos.')
          }

          const remaining = MAX_FAILED_ATTEMPTS - newAttempts
          throw new Error(`Credenciales inválidas. ${remaining} intento(s) restante(s).`)
        }

        // Successful login — reset failed attempts
        await db.user.update({
          where: { id: user.id },
          data: { failedAttempts: 0, lockedAt: null },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
          businessName: user.business.name,
          businessSlug: user.business.slug,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.businessId = (user as any).businessId
        token.businessName = (user as any).businessName
        token.businessSlug = (user as any).businessSlug
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as any
        session.user.businessId = token.businessId as string
        session.user.businessName = token.businessName as string
        session.user.businessSlug = token.businessSlug as string
      }
      return session
    },
  },
}
