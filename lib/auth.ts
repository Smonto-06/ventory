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

const LOCK_DURATION_MS = 15 * 60 * 1000
const MAX_FAILED_ATTEMPTS = 5

// Hash sin dueño (de una contraseña que nadie usa), con el mismo costo (12)
// que bcrypt.hash() en el resto del código: sirve solo para que un correo
// inexistente tome aproximadamente el mismo tiempo en responder que uno que
// sí existe pero con contraseña incorrecta. Sin esto, un correo inexistente
// respondía casi de inmediato (sin bcrypt.compare) mientras uno real
// tardaba los ~50-100ms del hash — una diferencia de tiempo medible que
// permite enumerar qué correos están registrados.
const DUMMY_HASH = '$2b$12$yAM3N2fqGIQeIIh/IudS3eApU7UUXRp0RYCTjkkkwRBCGmYEUdSrm'

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
          // Compara igual contra un hash de relleno, para no delatar por el
          // tiempo de respuesta que este correo no existe (ver DUMMY_HASH).
          await bcrypt.compare(credentials.password, DUMMY_HASH)
          throw new Error('Correo o contraseña incorrectos')
        }

        // Igual que en el login por PIN: sin este freno, el email+contraseña
        // (la puerta de entrada principal) se podía probar por fuerza bruta
        // sin ningún límite. Aquí sí es inequívoco a quién bloquear (un solo
        // correo, no varios cajeros compartiendo el mismo intento).
        let intentosPrevios = user.failedAttempts
        if (user.lockedAt) {
          const lockExpires = new Date(user.lockedAt.getTime() + LOCK_DURATION_MS)
          if (new Date() < lockExpires) {
            throw new Error('Demasiados intentos fallidos. Intenta de nuevo en unos minutos.')
          }
          await db.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedAt: null },
          })
          // El bloqueo ya venció y se limpió en BD, pero `user` sigue con el
          // valor viejo (5 o más) leído antes del reset — sin esto, el
          // primer intento fallido tras vencer el bloqueo volvía a calcular
          // 6 y relanzaba el bloqueo de una, en vez de dar las 5
          // oportunidades nuevas prometidas.
          intentosPrevios = 0
        }

        const passwordValid = await bcrypt.compare(credentials.password, user.password)

        if (!passwordValid) {
          const failedAttempts = intentosPrevios + 1
          await db.user.update({
            where: { id: user.id },
            data: {
              failedAttempts,
              ...(failedAttempts >= MAX_FAILED_ATTEMPTS ? { lockedAt: new Date() } : {}),
            },
          })
          throw new Error('Correo o contraseña incorrectos')
        }

        // Un usuario desactivado (Ajustes → Usuarios) no puede entrar, ni
        // siquiera si todavía recuerda su contraseña — si no, "Desactivar"
        // no protege nada de verdad.
        if (!user.isActive) {
          throw new Error('Esta cuenta está desactivada. Contacta al administrador del negocio.')
        }

        if (!user.emailVerified) {
          throw new Error('Confirma tu correo antes de entrar. Revisa tu bandeja (y el spam).')
        }

        if (user.failedAttempts > 0 || user.lockedAt) {
          await db.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedAt: null },
          })
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
      if (!token?.id) return session

      // Se revisa en cada resolución de sesión (no solo al iniciar sesión):
      // un usuario desactivado a mitad de turno debe perder acceso de una,
      // no seguir vendiendo hasta que la cookie de 8h expire por su cuenta.
      // NextAuth trata null/undefined como "sin sesión" para getServerSession.
      // De paso se refrescan role/branchId desde la BD (no solo isActive):
      // el rol y la sucursal quedaban "congelados" en el JWT firmado al
      // iniciar sesión, así que degradar a un ADMIN a CAJERO (o reasignarlo
      // de sucursal) no le quitaba esos permisos hasta que la cookie de 8h
      // expirara por su cuenta.
      const activo = await db.user.findUnique({
        where: { id: token.id as string },
        select: { isActive: true, role: true, branchId: true },
      })
      if (!activo?.isActive) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return null as any
      }

      session.user.id = token.id as string
      session.user.role = activo.role
      session.user.businessId = token.businessId as string
      session.user.branchId = activo.branchId ?? undefined
      session.user.businessName = token.businessName as string
      session.user.businessSlug = token.businessSlug as string
      return session
    },
  },
}
