import { NextAuthOptions, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import { db } from './db'


interface VentoryUser extends User {
  role: UserRole
  businessId: string
  branchId?: string
  businessName: string
  businessSlug: string
}

export const authOptions: NextAuthOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          throw new Error('Correo o contraseña incorrectos')
        }

        const passwordValid = await bcrypt.compare(credentials.password, user.password)

        if (!passwordValid) {
          throw new Error('Correo o contraseña incorrectos')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
          branchId: user.branchId ?? undefined,
          businessName: user.business.name,
          businessSlug: user.business.slug,
        } satisfies VentoryUser
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const v = user as VentoryUser
        token.id = v.id
        token.role = v.role
        token.businessId = v.businessId
        token.branchId = v.branchId
        token.businessName = v.businessName
        token.businessSlug = v.businessSlug
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.businessId = token.businessId as string
        session.user.branchId = token.branchId as string | undefined
        session.user.businessName = token.businessName as string
        session.user.businessSlug = token.businessSlug as string
      }
      return session
    },
  },
}
