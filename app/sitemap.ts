import type { MetadataRoute } from 'next'

// El mapa del sitio para los buscadores: solo las páginas públicas.

const BASE = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'https://ventory-ten.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/ayuda`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/register`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${BASE}/login`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terminos`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacidad`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
