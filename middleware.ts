import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Redirect authenticated users away from las pantallas de inicio de
    // sesión — pero NO de /register: una sesión vieja en el navegador no
    // debe impedir crear un negocio nuevo (antes mandaba directo al sistema
    // y tocaba cerrar sesión primero).
    if (token && (pathname.startsWith('/login') || pathname.startsWith('/pin-login'))) {
      return NextResponse.redirect(new URL('/app', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ req, token }) {
        const pathname = req.nextUrl.pathname

        // Public routes
        if (
          pathname.startsWith('/login') ||
          pathname.startsWith('/register') ||
          pathname.startsWith('/pin-login') ||
          pathname.startsWith('/forgot') ||
          pathname.startsWith('/reset') ||
          pathname.startsWith('/verify') ||
          pathname.startsWith('/terminos') ||
          pathname.startsWith('/privacidad') ||
          pathname.startsWith('/ayuda') ||
          pathname.startsWith('/api/auth') ||
          pathname.startsWith('/api/register') ||
          pathname.startsWith('/api/health') ||
          // El cron de Vercel llama sin sesión: la ruta se protege sola con
          // CRON_SECRET. Sin esta excepción el middleware lo redirigiría al
          // login y el resumen diario nunca se enviaría.
          pathname.startsWith('/api/cron') ||
          // Los webhooks de las pasarelas también llegan sin sesión: Wompi se
          // protege con la firma del evento; Mercado Pago, verificando el pago
          // contra su API antes de creer nada
          pathname.startsWith('/api/wompi') ||
          pathname.startsWith('/api/mercadopago') ||
          pathname === '/'
        ) {
          return true
        }

        // All other routes require authentication
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    // robots.txt, sitemap.xml y los archivos de verificación de Google Search
    // Console (google….html) son para los buscadores: sin sesión, siempre
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|sitemap.xml|google[a-zA-Z0-9]*\\.html|.*\\.(?:png|webp|jpg|jpeg|svg|gif|ico)$).*)',
  ],
}
