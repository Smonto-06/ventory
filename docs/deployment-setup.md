# Guía de Configuración de Despliegue — Ventory

Esta guía cubre la configuración inicial de Railway, GitHub Actions y Sentry
para los entornos de staging y production.

## 1. Railway

### Crear el proyecto

1. Ve a https://railway.app y crea una cuenta
2. Nuevo proyecto → "Empty Project"
3. Nombra el proyecto `ventory`

### Crear servicios

Para cada entorno (staging y production):

```
Proyecto ventory
├── ventory-staging        (servicio Next.js)
│   └── ventory-staging-db (PostgreSQL)
└── ventory-production     (servicio Next.js)
    └── ventory-production-db (PostgreSQL)
```

**Pasos:**
1. Add Service → Database → PostgreSQL
2. Add Service → GitHub Repo (conecta el repo de Ventory)
3. Configura las variables de entorno en cada servicio (ver sección 4)

### Obtener Railway Token

1. Railway → Account Settings → Tokens
2. Crea `github-actions-staging`
3. Crea `github-actions-production`
4. Agrega cada token como secret en GitHub (ver sección 2)

## 2. GitHub — Environments y Secrets

### Environments

1. Repositorio → Settings → Environments
2. Crea `staging`:
   - Sin required reviewers
   - Deployment branches: `main`
3. Crea `production`:
   - Required reviewers: agrega CTO/CEO (mínimo 1)
   - Deployment branches: `main`

### Repository Secrets

Settings → Secrets and variables → Actions → New repository secret

| Secret | Descripción |
|--------|-------------|
| `DATABASE_URL_DEV` | URL de BD para pruebas en CI (puede ser local o Railway) |
| `DATABASE_URL_STAGING` | PostgreSQL de Railway staging |
| `DATABASE_URL_PRODUCTION` | PostgreSQL de Railway production |
| `NEXTAUTH_URL_STAGING` | URL pública de staging |
| `NEXTAUTH_SECRET_STAGING` | Secret de NextAuth para staging (`openssl rand -base64 32`) |
| `NEXTAUTH_URL_PRODUCTION` | URL pública de production |
| `NEXTAUTH_SECRET_PRODUCTION` | Secret de NextAuth para production |
| `NEXT_PUBLIC_APP_URL_STAGING` | URL pública de staging |
| `NEXT_PUBLIC_APP_URL_PRODUCTION` | URL pública de production |
| `SENTRY_DSN_STAGING` | DSN del proyecto ventory-staging en Sentry |
| `SENTRY_DSN_PRODUCTION` | DSN del proyecto ventory-production en Sentry |
| `RAILWAY_TOKEN_STAGING` | Token de Railway para el servicio staging |
| `RAILWAY_TOKEN_PRODUCTION` | Token de Railway para el servicio production |
| `SENTRY_AUTH_TOKEN` | Token Sentry para subir source maps |
| `SENTRY_ORG` | Slug de la organización en Sentry (e.g. `ventory`) |

## 3. Sentry

1. https://sentry.io → nueva organización `ventory`
2. Crea proyecto `ventory-staging` (Next.js)
3. Crea proyecto `ventory-production` (Next.js)
4. Guarda los DSN de cada proyecto
5. Account Settings → API Tokens → crea token con `project:releases`
6. Agrega `SENTRY_AUTH_TOKEN` y `SENTRY_ORG` como secrets en GitHub

## 4. Variables de entorno en Railway

En cada servicio de app en Railway, configura manualmente:

```
NODE_ENV              = production
NEXT_PUBLIC_APP_URL   = https://ventory-staging.up.railway.app
NEXTAUTH_URL          = https://ventory-staging.up.railway.app
NEXTAUTH_SECRET       = [genera con: openssl rand -base64 32]
NEXT_PUBLIC_SENTRY_DSN = https://...@sentry.io/...
RAILWAY_ENVIRONMENT   = staging
```

Railway inyecta `DATABASE_URL` automáticamente si la BD está en el mismo proyecto.

## 5. Verificación del Pipeline

Una vez configurado todo, verifica el flujo:

```
1. Abre un PR → CI corre automáticamente (lint + build + tests)
2. Merge a main → staging deploy corre automáticamente
3. GET /api/health en staging → {"status":"ok","env":"staging"}
4. Deploy a production:
   Actions → "Deploy → Production" → Run workflow
   → escribe "deploy" → da razón → un reviewer aprueba en GitHub
```

## URLs de Referencia

| Servicio | URL |
|----------|-----|
| App Staging | Pendiente de Railway |
| App Production | Pendiente de Railway |
| Railway Dashboard | https://railway.app |
| Sentry | https://sentry.io/organizations/ventory/ |
