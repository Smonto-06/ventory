import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Negocio 1: Tienda La Esperanza
  const business1 = await db.business.upsert({
    where: { slug: 'la-esperanza' },
    update: {},
    create: {
      name: 'Tienda La Esperanza',
      slug: 'la-esperanza',
    },
  })

  // Admin del negocio 1
  await db.user.upsert({
    where: { email: 'admin@laesperanza.com' },
    update: {},
    create: {
      email: 'admin@laesperanza.com',
      password: await bcrypt.hash('Admin1234!', 12),
      name: 'María González',
      role: 'ADMIN',
      businessId: business1.id,
    },
  })

  // Cajero del negocio 1 con PIN
  await db.user.upsert({
    where: { email: 'cajero@laesperanza.com' },
    update: {},
    create: {
      email: 'cajero@laesperanza.com',
      password: await bcrypt.hash('Cajero1234!', 12),
      name: 'Carlos Ruiz',
      role: 'CASHIER',
      pin: await bcrypt.hash('1234', 12),
      businessId: business1.id,
    },
  })

  // Negocio 2: Minimercado El Sol
  const business2 = await db.business.upsert({
    where: { slug: 'minimercado-el-sol' },
    update: {},
    create: {
      name: 'Minimercado El Sol',
      slug: 'minimercado-el-sol',
    },
  })

  // Admin del negocio 2
  await db.user.upsert({
    where: { email: 'admin@elsol.com' },
    update: {},
    create: {
      email: 'admin@elsol.com',
      password: await bcrypt.hash('Admin1234!', 12),
      name: 'Pedro Martínez',
      role: 'ADMIN',
      businessId: business2.id,
    },
  })

  // Cajero del negocio 2 con PIN diferente
  await db.user.upsert({
    where: { email: 'cajero@elsol.com' },
    update: {},
    create: {
      email: 'cajero@elsol.com',
      password: await bcrypt.hash('Cajero1234!', 12),
      name: 'Ana López',
      role: 'CASHIER',
      pin: await bcrypt.hash('5678', 12),
      businessId: business2.id,
    },
  })

  console.log('✓ 2 negocios creados con aislamiento multi-tenant')
  console.log(`  Negocio 1: ${business1.name} (slug: ${business1.slug}, id: ${business1.id})`)
  console.log(`  Negocio 2: ${business2.name} (slug: ${business2.slug}, id: ${business2.id})`)
  console.log('')
  console.log('Cuentas de prueba:')
  console.log('  Negocio 1 — Admin:  admin@laesperanza.com / Admin1234!')
  console.log('  Negocio 1 — Cajero: PIN 1234 en negocio: la-esperanza')
  console.log('  Negocio 2 — Admin:  admin@elsol.com / Admin1234!')
  console.log('  Negocio 2 — Cajero: PIN 5678 en negocio: minimercado-el-sol')
}

main()
  .then(async () => { await db.$disconnect() })
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
