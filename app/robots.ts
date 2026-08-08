import type { MetadataRoute } from 'next'

// Qué puede leer Google (y cualquier buscador): las páginas públicas sí; la
// aplicación, el panel y el API no — ahí no hay nada indexable y solo
// gastarían rastreo en pantallas que exigen sesión.

const BASE = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'https://ventory-ten.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app', '/admin', '/api/', '/pin-login', '/verify', '/reset'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
